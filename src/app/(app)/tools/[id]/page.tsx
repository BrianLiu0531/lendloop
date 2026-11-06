import { Suspense } from "react";
import { ToolDetail } from "./tool-detail";

export default function ToolPage() {
  return (
    <Suspense>
      <ToolDetail />
    </Suspense>
  );
}
