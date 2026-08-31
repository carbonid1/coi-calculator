import {
  Atom,
  Bird,
  Archive,
  Boxes,
  BriefcaseBusiness,
  Cloud,
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
  mines: Pickaxe,
  reserves: Archive,
  nuclear: Atom,
};
