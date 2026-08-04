import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Printer, ShieldCheck, Loader2, X, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiGet } from "@/api/client";

interface VerifyResult {
  valid: boolean;
  holder?: string;
  courseName?: string;
  issuedDate?: string;
  expiryDate?: string;
  status?: string;
}

// The server returns snake_case keys; normalize into the shape the UI expects.
function normalizeVerifyResponse(raw: any): VerifyResult {
  return {
    valid: Boolean(raw?.is_valid ?? raw?.valid ?? (raw?.status === "active")),
    status: raw?.status,
    courseName: raw?.course_title ?? raw?.courseName,
    issuedDate: raw?.issued_at ?? raw?.issuedDate,
    expiryDate: raw?.expires_at ?? raw?.expiryDate,
    holder: raw?.holder,
  };
}

interface CertificateDownloadProps {
  certificateId: string;
  className?: string;
  // When false (default for employees), the Verify button is hidden.
  // Admins pass showVerify={true} from the certifications page.
  showVerify?: boolean;
}

export default function CertificateDownload({ certificateId, className = "", showVerify = false }: CertificateDownloadProps) {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [showVerifyResult, setShowVerifyResult] = useState(false);

  // Fetch the certificate through the authenticated axios client (token in the
  // Authorization HEADER, never the URL) and open it from a blob URL. This
  // avoids embedding the JWT in the query string, which previously leaked it
  // into browser history, server access logs, and referrer headers (BUG-02).
  // `print` opens with the server's ?print=1 auto-print page.
  const openCertificate = async (print: boolean) => {
    setDownloading(true);
    try {
      const res = await api.get(
        `/certificates/${certificateId}/download${print ? "?print=1" : ""}`,
        { responseType: "blob" },
      );
      const blobUrl = URL.createObjectURL(res.data as Blob);
      const win = window.open(blobUrl, "_blank");
      // Revoke after the new tab has had time to load the blob.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      if (!win) toast.error(t("certificate.popupBlocked"));
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message || t("certificate.openFailed"),
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = () => openCertificate(false);

  const handleVerify = async () => {
    setVerifying(true);
    setShowVerifyResult(true);
    try {
      const res = await apiGet<any>(`/certificates/${certificateId}/verify`);
      if (res.success && res.data) {
        setVerifyResult(normalizeVerifyResponse(res.data));
      } else {
        setVerifyResult({ valid: false });
      }
    } catch {
      toast.error(t("certificate.verifyFailed"));
      setVerifyResult({ valid: false });
    } finally {
      setVerifying(false);
    }
  };

  const closeVerify = () => {
    setShowVerifyResult(false);
    setVerifyResult(null);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-2">
        {/* Download PDF button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 transition disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {t("certificate.download")}
        </button>

        {/* Print button — opens the certificate with ?print=1 so the server
            page auto-triggers the print dialog once fully rendered (reliable
            across browsers; avoids the cross-tab win.print() load race). */}
        <button
          onClick={() => openCertificate(true)}
          disabled={downloading}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <Printer className="h-3.5 w-3.5" />
          {t("certificate.print")}
        </button>

        {/* Verify button — admin only */}
        {showVerify && (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {verifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {t("certificate.verify")}
          </button>
        )}
      </div>

      {/* Verification result card */}
      {showVerifyResult && (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
          {verifying ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              <span className="ml-2 text-sm text-gray-500">{t("certificate.verifying")}</span>
            </div>
          ) : verifyResult ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {verifyResult.valid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span
                    className={`text-sm font-semibold ${
                      verifyResult.valid ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {verifyResult.valid ? t("certificate.valid") : t("certificate.invalid")}
                  </span>
                </div>
                <button
                  onClick={closeVerify}
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {verifyResult.valid && (
                <dl className="space-y-1 text-xs text-gray-600">
                  {verifyResult.holder && (
                    <div className="flex justify-between">
                      <dt className="font-medium">{t("certificate.holder")}</dt>
                      <dd>{verifyResult.holder}</dd>
                    </div>
                  )}
                  {verifyResult.courseName && (
                    <div className="flex justify-between">
                      <dt className="font-medium">{t("certificate.course")}</dt>
                      <dd>{verifyResult.courseName}</dd>
                    </div>
                  )}
                  {verifyResult.issuedDate && (
                    <div className="flex justify-between">
                      <dt className="font-medium">{t("certificate.issued")}</dt>
                      <dd>{verifyResult.issuedDate}</dd>
                    </div>
                  )}
                  {verifyResult.status && (
                    <div className="flex justify-between">
                      <dt className="font-medium">{t("certificate.status")}</dt>
                      <dd className="capitalize">{verifyResult.status}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
