import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import type { elements } from "@shopify/polaris-types";

type ModalInstance = InstanceType<typeof elements.Modal>;

interface RedirectModalProps {
  onConfirmDelete: (collectionId: string, fromPath: string | null, toPath: string | null) => void;
  onBulkDelete: (ids: string[]) => void;
  isDeleting: boolean;
}

type ModalMode = "single" | "bulk";

interface ModalState {
  mode: ModalMode;
  collectionId: string;
  collectionHandle: string;
  bulkIds: string[];
}

export interface RedirectModalHandle {
  openSingle: (collectionHandle: string, collectionId: string) => void;
  openBulk: (ids: string[]) => void;
}

export const RedirectModal = forwardRef<RedirectModalHandle, RedirectModalProps>(
  function RedirectModal({ onConfirmDelete, onBulkDelete, isDeleting }, ref) {
    const modalRef = useRef<ModalInstance>(null);
    const [fromPath, setFromPath] = useState("");
    const [toPath, setToPath] = useState("");
    const [createRedirect, setCreateRedirect] = useState(false);
    const [state, setState] = useState<ModalState>({
      mode: "single",
      collectionId: "",
      collectionHandle: "",
      bulkIds: [],
    });

    useImperativeHandle(ref, () => ({
      openSingle(collectionHandle: string, collectionId: string) {
        setState({ mode: "single", collectionId, collectionHandle, bulkIds: [] });
        setFromPath(`/collections/${collectionHandle}`);
        setToPath("/collections");
        setCreateRedirect(false);
        modalRef.current?.showOverlay();
      },
      openBulk(ids: string[]) {
        setState({ mode: "bulk", collectionId: "", collectionHandle: "", bulkIds: ids });
        setFromPath("");
        setToPath("");
        setCreateRedirect(false);
        modalRef.current?.showOverlay();
      },
    }));

    const handleClose = () => {
      modalRef.current?.hideOverlay();
    };

    const handleConfirm = () => {
      if (state.mode === "single") {
        onConfirmDelete(
          state.collectionId,
          createRedirect ? fromPath : null,
          createRedirect ? toPath : null,
        );
      } else {
        onBulkDelete(state.bulkIds);
      }
      handleClose();
    };

    const handleRedirectToggle = (e: Event) => {
      setCreateRedirect((e.target as HTMLInputElement).checked);
    };

    const isBulk = state.mode === "bulk";
    const count = isBulk ? state.bulkIds.length : 1;

    return (
      <s-modal
        ref={modalRef}
        heading={`Delete ${isBulk ? `${count} Collections` : "Collection"}`}
        size="base"
        onHide={handleClose}
      >
        <s-stack direction="block" gap="base">
          <s-banner tone="critical" heading="This action cannot be undone">
            {isBulk
              ? `You are about to permanently delete ${count} collection${count !== 1 ? "s" : ""}. This will not delete the products inside them.`
              : `You are about to permanently delete this collection. This will not delete its products.`}
          </s-banner>

          {!isBulk && (
            <s-stack direction="block" gap="base">
              <s-checkbox
                label="Create a URL redirect before deleting"
                checked={createRedirect}
                onChange={handleRedirectToggle}
              />

              {createRedirect && (
                <s-stack direction="block" gap="base">
                  <s-text-field
                    label="Redirect from (old path)"
                    value={fromPath}
                    onInput={(e: Event) => setFromPath((e.target as HTMLInputElement).value)}
                  />
                  <s-url-field
                    label="Redirect to (new destination)"
                    value={toPath}
                    onInput={(e: Event) => setToPath((e.target as HTMLInputElement).value)}
                  />
                </s-stack>
              )}
            </s-stack>
          )}

          {isBulk && (
            <s-paragraph>
              URL redirects are not created for bulk deletions. Delete individual collections to
              set up redirects.
            </s-paragraph>
          )}
        </s-stack>

        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          onClick={handleConfirm}
          {...(isDeleting ? { loading: true } : {})}
        >
          {isDeleting ? "Deleting..." : `Delete ${isBulk ? "all" : "collection"}`}
        </s-button>
        <s-button slot="secondary-actions" variant="secondary" onClick={handleClose}>
          Cancel
        </s-button>
      </s-modal>
    );
  },
);
