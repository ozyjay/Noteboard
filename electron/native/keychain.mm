#import <Foundation/Foundation.h>
#import <LocalAuthentication/LocalAuthentication.h>
#import <Security/Security.h>
#import <Security/SecTask.h>
#include <node_api.h>

// Loaded only by the trusted main process. No arbitrary Keychain queries.
static NSString *ApplicationIdentifier() {
  SecTaskRef task = SecTaskCreateFromSelf(kCFAllocatorDefault);
  if (!task) return nil;
  CFTypeRef value = SecTaskCopyValueForEntitlement(
      task, CFSTR("com.apple.application-identifier"), nullptr);
  CFTypeRef groups = SecTaskCopyValueForEntitlement(
      task, CFSTR("keychain-access-groups"), nullptr);
  CFRelease(task);
  NSString *identifier = CFBridgingRelease(value);
  NSArray *accessGroups = CFBridgingRelease(groups);
  if (![identifier isKindOfClass:[NSString class]] ||
      ![identifier hasSuffix:@".app.noteboard.desktop"] ||
      ![accessGroups isKindOfClass:[NSArray class]] ||
      ![accessGroups containsObject:identifier]) return nil;
  return identifier;
}

static napi_value Fail(napi_env env, OSStatus status) {
  NSString *message;
  if (status == errSecUserCanceled || status == errSecAuthFailed) {
    message = @"Credential unlock was cancelled or not authorised. Try again with Touch ID or the macOS password fallback.";
  } else if (status == errSecMissingEntitlement) {
    message = @"Touch ID credential storage requires a signed Noteboard app with a matching provisioning profile and Keychain entitlements. See docs/development.md.";
  } else if (status == errSecItemNotFound) {
    message = @"The Noteboard credential key is missing from this Mac. Existing credentials have not been replaced.";
  } else {
    message = [NSString stringWithFormat:@"Could not access Touch ID protected credentials (macOS error %d). Existing credentials have not been replaced.", (int)status];
  }
  napi_throw_error(env, "NOTEBOARD_KEYCHAIN", message.UTF8String);
  return nullptr;
}

static napi_value Available(napi_env env, napi_callback_info info) {
  @autoreleasepool {
    napi_value result;
    napi_get_boolean(env, ApplicationIdentifier() != nil, &result);
    return result;
  }
}

static napi_value Unlock(napi_env env, napi_callback_info info) {
  @autoreleasepool {
    size_t argc = 2;
    napi_value args[2];
    if (napi_get_cb_info(env, info, &argc, args, nullptr, nullptr) != napi_ok || argc != 2) {
      napi_throw_type_error(env, nullptr, "Expected a vault identifier and creation flag");
      return nullptr;
    }
    char account[65] = {};
    size_t length = 0;
    bool create = false;
    if (napi_get_value_string_utf8(env, args[0], nullptr, 0, &length) != napi_ok ||
        length != 64 ||
        napi_get_value_string_utf8(env, args[0], account, sizeof(account), &length) != napi_ok ||
        strspn(account, "0123456789abcdef") != 64 ||
        napi_get_value_bool(env, args[1], &create) != napi_ok) {
      napi_throw_type_error(env, nullptr, "Invalid vault identifier or creation flag");
      return nullptr;
    }
    NSString *identifier = ApplicationIdentifier();
    if (!identifier) return Fail(env, errSecMissingEntitlement);
    NSDictionary *base = @{
      (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
      (__bridge id)kSecAttrService: @"app.noteboard.credentials.v1",
      (__bridge id)kSecAttrAccount: [NSString stringWithUTF8String:account],
      (__bridge id)kSecAttrAccessGroup: identifier,
      (__bridge id)kSecUseDataProtectionKeychain: @YES,
      (__bridge id)kSecAttrSynchronizable: @NO,
    };
    LAContext *context = [[LAContext alloc] init];
    context.localizedReason = @"unlock your Noteboard ChatGPT credentials";
    NSMutableDictionary *query = [base mutableCopy];
    query[(__bridge id)kSecReturnData] = @YES;
    query[(__bridge id)kSecUseAuthenticationContext] = context;
    CFTypeRef result = nullptr;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
    if (status == errSecItemNotFound && create) {
      NSMutableData *key = [NSMutableData dataWithLength:32];
      status = SecRandomCopyBytes(kSecRandomDefault, key.length, (uint8_t *)key.mutableBytes);
      if (status != errSecSuccess) return Fail(env, status);
      CFErrorRef error = nullptr;
      SecAccessControlRef access = SecAccessControlCreateWithFlags(
          kCFAllocatorDefault, kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
          kSecAccessControlUserPresence, &error);
      if (!access) {
        if (error) CFRelease(error);
        memset(key.mutableBytes, 0, key.length);
        return Fail(env, errSecParam);
      }
      NSMutableDictionary *item = [base mutableCopy];
      item[(__bridge id)kSecAttrAccessControl] = (__bridge id)access;
      item[(__bridge id)kSecAttrLabel] = @"Noteboard credentials (Touch ID)";
      item[(__bridge id)kSecValueData] = key;
      status = SecItemAdd((__bridge CFDictionaryRef)item, nullptr);
      CFRelease(access);
      memset(key.mutableBytes, 0, key.length);
      if (status != errSecSuccess && status != errSecDuplicateItem) return Fail(env, status);
      // Read back through the access control, including on first creation.
      status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
    }
    if (status != errSecSuccess) {
      if (result) CFRelease(result);
      return Fail(env, status);
    }
    NSData *key = CFBridgingRelease(result);
    if (![key isKindOfClass:[NSData class]] || key.length != 32) return Fail(env, errSecDecode);
    napi_value buffer;
    napi_status copied = napi_create_buffer_copy(env, key.length, key.bytes, nullptr, &buffer);
    [context invalidate];
    if (copied != napi_ok) return nullptr;
    return buffer;
  }
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor methods[] = {
    {"available", nullptr, Available, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"unlock", nullptr, Unlock, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, 2, methods);
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
