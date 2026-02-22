import { useEffect } from "react";

export function useGlobalShortcuts(
    onNew?: () => void,
    onRefresh?: () => void,
) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input/textarea
            if (
                document.activeElement?.tagName === "INPUT" ||
                document.activeElement?.tagName === "TEXTAREA" ||
                document.activeElement?.tagName === "SELECT"
            ) {
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                if (e.key === "n" || e.key === "N") {
                    if (onNew) {
                        e.preventDefault();
                        onNew();
                    }
                }
                if (e.key === "r" || e.key === "R") {
                    // Allow default browser refresh in dev, but if we have a handler, call it
                    if (onRefresh) {
                        e.preventDefault();
                        onRefresh();
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onNew, onRefresh]);
}
