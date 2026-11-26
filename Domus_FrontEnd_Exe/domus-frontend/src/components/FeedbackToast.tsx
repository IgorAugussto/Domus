interface FeedbackToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

export function FeedbackToast({
  message,
  type = "success",
  onClose,
}: FeedbackToastProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        role={type === "error" ? "alert" : "status"}
        className="pointer-events-auto px-5 py-4 rounded-xl shadow-xl flex items-center gap-4 min-w-[280px]"
        style={{
          background:
            type === "success"
              ? "#ecfdf5"
              : "#fef2f2",

          color:
            type === "success"
              ? "#065f46"
              : "#991b1b",
        }}
      >
        <span className="text-sm font-medium text-center">{message}</span>

        <button
          aria-label="Fechar aviso"
          onClick={onClose}
          className="ml-auto text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
