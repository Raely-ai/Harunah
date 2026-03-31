import { db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export const updateSocialField = async (uid: string, field: string, value: any) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    [`social.${field}`]: value
  });
};
