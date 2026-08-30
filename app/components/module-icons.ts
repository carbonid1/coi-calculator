import {
  Atom,
  Bird,
  Archive,
  Boxes,
  BriefcaseBusiness,
  Cloud,
  Construction,
  FlaskConical,
  Pickaxe,
  Sprout,
  TreePine,
  type LucideIcon,
} from "lucide-react";

export const moduleIcons: Partial<Record<string, LucideIcon>> = {
  general: Boxes,
  forestry: TreePine,
  "process-steam": Cloud,
  research: FlaskConical,
  offices: BriefcaseBusiness,
  greenhouses: Sprout,
  "chicken-farms": Bird,
  "static-infrastructure": Construction,
  mines: Pickaxe,
  reserves: Archive,
  nuclear: Atom,
};
