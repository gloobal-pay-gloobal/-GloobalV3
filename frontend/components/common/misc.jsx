// src/components/common/misc.jsx
import { useMemo as useMemo3 } from "react";
import {
  Lock as Lock2
} from "lucide-react";
function ServiceLock({ locked = true, size = 15 }) {
  return <Lock2
    size={size}
    color={locked ? T.negative : T.positive}
    style={{ flexShrink: 0 }}
    aria-hidden="true"
  />;
}

