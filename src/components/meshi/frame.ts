// iPhone のノッチ・ホームバーの分は safe-area の余白でよける(app/layout.tsx の viewportFit)。
export const FRAME_CLASS =
  "relative flex h-dvh w-full max-w-[402px] flex-col overflow-hidden bg-app pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:my-8 sm:h-[874px] sm:rounded-[32px] sm:border sm:border-card-border sm:shadow-card";
