import { useState, useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from "react";
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

// Stable ID so commandFor on the cancel button can target the modal natively.
const MODAL_ID = "delete-collection-modal";

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

    const handleClose = useCallback(() => {
      modalRef.current?.hideOverlay();
    }, []);

    // Safety net for the X button.
    // `click` is a composed event and bubbles out of shadow DOM. We listen at the s-modal
    // element and use composedPath() to find the innermost ShadowRoot the click passed through.
    // If that ShadowRoot's host IS the s-modal element, the click came from the modal's own
    // shadow DOM (X button or backdrop) and we call hideOverlay() as a fallback.
    // Crucially, clicks inside nested web-component shadow DOMs (e.g. s-checkbox, s-text-field)
    // have a different host, so they are correctly ignored and do NOT close the modal.
    useEffect(() => {
      const modal = modalRef.current as unknown as HTMLElement | null;
      if (!modal) return;

      const onModalClick = (event: MouseEvent) => {
        const nearestShadowRoot = event
          .composedPath()
          .find((node): node is ShadowRoot => node instanceof ShadowRoot);
        if (nearestShadowRoot && nearestShadowRoot.host === modal) {
          modalRef.current?.hideOverlay();
        }
      };

      modal.addEventListener("click", onModalClick);
      return () => modal.removeEventListener("click", onModalClick);
    }, []);

    const handleConfirm = useCallback(() => {
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
    }, [state, createRedirect, fromPath, toPath, onConfirmDelete, onBulkDelete, handleClose]);

    const handleRedirectToggle = (e: Event) => {
      setCreateRedirect((e.target as HTMLInputElement).checked);
    };

    const isBulk = state.mode === "bulk";
    const count = isBulk ? state.bulkIds.length : 1;

    return (
      <s-modal
        id={MODAL_ID}
        ref={modalRef}
        heading={`Delete ${isBulk ? `${count} Collections` : "Collection"}`}
        size="base"
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
          disabled={isDeleting || undefined}
          {...(isDeleting ? { loading: true } : {})}
        >
          {`Delete ${isBulk ? "all" : "collection"}`}
        </s-button>

        {/*
          Cancel uses commandFor/command instead of onClick.
          React synthetic events on s-button elements inside s-modal shadow-DOM slots are
          unreliable because React's delegated listener sits at the app root, and Shopify's
          surface-component slots can retarget the event before it reaches React.
          commandFor/command routes through the web component's own Invoker Commands system
          and is guaranteed to call hideOverlay() on the target element.
        */}
        <s-button
          slot="secondary-actions"
          variant="secondary"
          commandFor={MODAL_ID}
          command="--hide"
        >
          Cancel
        </s-button>
      </s-modal>
    );
  },
);
