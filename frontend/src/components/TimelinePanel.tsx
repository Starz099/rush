export const TimelinePanel = () => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 items-center border-b px-3">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Timeline
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex h-24 w-[80%] items-center justify-center bg-white/10 text-white/20 shadow-inner">
          Timeline tracks will appear here
        </div>
      </div>
    </div>
  )
}
