import { collection, addDoc } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { CentralizedReport } from "../types";
import { toast } from "sonner";

export const reportService = {
  async reportUser(params: {
    reportedUserId: string;
    source: CentralizedReport['source'];
    reason: string;
    description?: string;
    metadata?: any;
  }): Promise<void> {
    const reporterId = auth.currentUser?.uid;
    if (!reporterId) {
      toast.error("Rapor göndermek için giriş yapmalısınız.");
      return;
    }

    if (reporterId === params.reportedUserId) {
      toast.error("Kendinizi raporlayamazsınız.");
      return;
    }

    try {
      await addDoc(collection(db, "reports"), {
        reporterId,
        reportedUserId: params.reportedUserId,
        source: params.source,
        reason: params.reason,
        description: params.description || "",
        metadata: params.metadata || {},
        createdAt: new Date().toISOString(),
        status: 'pending'
      });
      toast.success("Raporunuz iletildi. Teşekkür ederiz.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "reports");
    }
  }
};
