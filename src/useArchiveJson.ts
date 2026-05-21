import { useEffect, useState } from "react";
import { fetchArchiveJson } from "./data";

type JsonState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "loaded"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: Error };

export function useArchiveJson<T>(path: string): JsonState<T> {
  const [state, setState] = useState<JsonState<T>>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;
    setState({ status: "loading" });

    fetchArchiveJson<T>(path)
      .then((data) => {
        if (isCurrent) {
          setState({ status: "loaded", data });
        }
      })
      .catch((error: Error) => {
        if (isCurrent) {
          setState({ status: "error", error });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [path]);

  return state;
}
