import {
  infiniteResearchCatalog,
  type InfiniteResearchId,
} from "../../db/research";

export type ResearchProgressMode = "before-space" | "full-range";

export const getDefaultResearchProgressMode = (
  levels: Readonly<Record<InfiniteResearchId, number>>,
): ResearchProgressMode => (
  infiniteResearchCatalog.some((research) => (
    levels[research.id] > research.spaceResearchLevel
  ))
    ? "full-range"
    : "before-space"
);
