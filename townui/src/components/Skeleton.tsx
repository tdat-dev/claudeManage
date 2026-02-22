export function SkeletonGroup({ count = 3, children }: { count?: number; children: React.ReactNode }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i}>{children}</div>
            ))}
        </>
    );
}

export function BlockSkeleton({ className }: { className?: string }) {
    return (
        <div
            className={`animate-pulse bg-town-surface-hover/50 rounded-lg ${className}`}
        />
    );
}

export function TextSkeleton({ width = "w-full", height = "h-4", className = "" }: { width?: string; height?: string; className?: string }) {
    return (
        <div
            className={`animate-pulse bg-town-surface-hover/60 rounded ${width} ${height} ${className}`}
        />
    );
}
