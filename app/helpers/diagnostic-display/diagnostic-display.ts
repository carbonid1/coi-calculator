import { type ResourceId, resources } from "../../db/resources";
import { type CapacityAction } from "../capacity-pools/capacity-pools";
import { type ContractImportLimit } from "../contracts/contract-resource-flows";
import { type DisplayableRecipe, getReadableLabel, getRecipeDisplayName } from "../recipe-display/recipe-display";

/** Diagnostic facts are selected by the calculators; player-facing wording lives here. */
export type DiagnosticMessage =
  | { kind: "no-producer" }
  | { kind: "input-limited" }
  | { kind: "shortage"; resourceIds: ResourceId[] }
  | { kind: "priority"; inputId: ResourceId; productIds: ResourceId[] }
  | { kind: "capacity"; actions: CapacityAction[] }
  | { kind: "outside-recipes"; quantity: number }
  | { kind: "contract-import"; quantity: number; needed?: number }
  | { kind: "contract-export"; quantity: number }
  | { kind: "contract-fuel"; quantity: number }
  | { kind: "contract-limit"; limit: ContractImportLimit }
  | { kind: "demand-met"; productIds: ResourceId[] }
  | { kind: "unsupported-products"; recipe: DisplayableRecipe; productNames: string[] }
  | {
    kind: "blocked-route";
    recipe: DisplayableRecipe;
    blockedBy: { resourceId: ResourceId; deficitIncrease: number } | null;
  };

const formatQuantity = (value: number) => parseFloat(
  Math.abs(value) > 0 && Math.abs(value) < 0.01 ? value.toPrecision(1) : value.toFixed(2),
);

const resourceNames = (ids: ResourceId[]) => [...new Set(ids)].map(id => resources[id].name);
const contractLimitLabels: Record<ContractImportLimit, string> = {
  disabled: "Planned off",
  "no-ship": "No Cargo Ship",
  paused: "Route paused",
  "voyage-unmeasured": "Voyage estimate unavailable",
  capacity: "Import capacity reached",
};

export const formatInputShortage = (names: string[]) => (
  names.length > 0 ? `${[...new Set(names)].join(", ")} short` : "Input supply limited"
);

const formatMessage = (message: DiagnosticMessage): string => {
  switch (message.kind) {
    case "no-producer": return "No producer";
    case "input-limited": return "Input supply limited";
    case "shortage": return formatInputShortage(resourceNames(message.resourceIds));
    case "priority":
      return `${resources[message.inputId].name} prioritized for ${resourceNames(message.productIds).join(", ")}`;
    case "outside-recipes": return `${formatQuantity(message.quantity)} outside recipes`;
    case "contract-import": return `Contract imports ${formatQuantity(message.quantity)}${message.needed == null ? '' : ` of ${formatQuantity(message.needed)} needed`}`;
    case "contract-export": return `${formatQuantity(message.quantity)} exported by contract`;
    case "contract-fuel": return `${formatQuantity(message.quantity)} contract ship fuel`;
    case "contract-limit": return contractLimitLabels[message.limit];
    case "demand-met": {
      const products = resourceNames(message.productIds);

      // A branching production chain can reach most of the factory. Listing it
      // does not help explain a single surplus row.
      if (products.length > 3) return "Product demand met";

      return products.length > 0 ? `${products.join(", ")} demand met` : "Demand met";
    }
    case "capacity": return [...new Set(message.actions.map(action => {
      const actions = [
        ...(action.unpause > 0 ? [`unpause ${action.unpause}`] : []),
        ...(action.build > 0 ? [`build ${action.build}`] : []),
      ];

      return `${action.label} · ${actions.length > 0 ? actions.join(", ") : "at capacity"}`;
    }))].join(" or ");
    case "blocked-route": {
      const blocker = message.blockedBy;
      const detail = blocker && blocker.deficitIncrease > 0
        ? `needs ${formatQuantity(blocker.deficitIncrease)} more ${resources[blocker.resourceId].name}`
        : "Input supply limited";

      return `${getRecipeDisplayName(message.recipe)} · ${detail}`;
    }
    case "unsupported-products": {
      const products = [...new Set(message.productNames.map(name => getReadableLabel(name) || "Unknown product"))];

      return `${getRecipeDisplayName(message.recipe)} · Unsupported products: ${products.join(", ")}.`;
    }
  }
};

/** Repeated lines or modules must not repeat identical explanations. */
export const formatDiagnosticMessages = (messages: DiagnosticMessage[]) => (
  [...new Set(messages.map(formatMessage))].join(" · ")
);
