import * as functions from "firebase-functions";

export const testPing = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    console.log("TEST FUNCTION HIT ✅");
    return {
      success: true,
      message: "Function is working",
      uid: context.auth?.uid || null,
    };
  });
