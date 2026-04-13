import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../lib/firebase";
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
      const createReportFunc = httpsCallable(functions, 'createReport');
      await createReportFunc({
        reportedUserId: params.reportedUserId,
        source: params.source,
        reason: params.reason,
        description: params.description || "",
        metadata: params.metadata || {}
      });
      toast.success("Raporunuz iletildi. Teşekkür ederiz.");
    } catch (error: any) {
      console.error("Error reporting user:", error);
      toast.error(error.message || "Şikayet gönderilirken bir hata oluştu.");
    }
  }
};
