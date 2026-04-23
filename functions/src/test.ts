import * as functions from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";

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

export const testPingV2 = onCall({ cors: true, region: "us-central1" }, async (request) => {
  return {
    success: true,
    message: "V2 Function is working",
    uid: request.auth?.uid || null,
  };
});
