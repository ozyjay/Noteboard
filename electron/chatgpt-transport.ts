// Translate transport failures only; HTTP and response-validation errors retain
// their own messages. Never replay a generation request automatically.
export async function chatGPTTransport<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal | null,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "TimeoutError")
    ) {
      if (
        signal?.reason?.name === "TimeoutError" ||
        (error instanceof Error && error.name === "TimeoutError")
      )
        throw new Error(
          "ChatGPT did not finish within the time limit. No completed response was saved. Try again when ready.",
          { cause: error },
        );
      throw new Error(
        "Generation cancelled. No Note or document was created.",
        { cause: error },
      );
    }
    throw new Error(
      "The connection to ChatGPT was interrupted. No completed response was saved. Check your connection and try again when ready.",
      { cause: error },
    );
  }
}
