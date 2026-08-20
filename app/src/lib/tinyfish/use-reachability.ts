import { useEffect, useState } from "react";
import {
  type TinyFishReachability,
  probeTinyFishApp,
} from "@/lib/tinyfish/probe";

export function useTinyFishReachability(url: string): TinyFishReachability {
  const [status, setStatus] = useState<TinyFishReachability>("checking");

  useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    void probeTinyFishApp(url).then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return status;
}
