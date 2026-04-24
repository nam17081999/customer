import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  loading = false,
  variant = 'default',
  onConfirm,
}) {
  const confirmVariant = variant === 'destructive' ? 'destructiveConfirm' : 'primary'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] z-[310] max-w-sm rounded-xl border border-gray-800 bg-gray-950 p-0 sm:w-full">
        <div className="space-y-2 px-4 pt-4">
          <DialogTitle className="text-base font-semibold text-gray-100">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-sm leading-relaxed text-gray-400">
              {description}
            </DialogDescription>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2 border-t border-gray-800 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange?.(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            className="flex-1"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
