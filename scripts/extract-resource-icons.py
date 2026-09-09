"""Extract the explicitly mapped UI icons from a local Captain of Industry install.

Requires UnityPy. Does not modify game files or infer mappings from asset names.
"""

import argparse
import json
from pathlib import Path

import UnityPy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("game_directory", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parent.parent
    manifest = json.loads((repo / "app/db/resource-icons.json").read_text(encoding="utf-8"))
    output = repo / "public/resource-icons"
    bundles = {}

    # Validate all references before writing any assets.
    images = {}
    for resource_id, entry in manifest.items():
        if entry is None:
            continue
        bundle = entry["bundle"]
        if bundle not in bundles:
            bundles[bundle] = UnityPy.load(str(args.game_directory / "AssetBundles" / bundle))
        obj = bundles[bundle].container[entry["asset"]]
        if obj.type.name not in ("Sprite", "Texture2D"):
            raise ValueError(f"Unexpected icon type for {resource_id}: {obj.type.name}")
        images[resource_id] = obj.deref_parse_as_object().image

    output.mkdir(parents=True, exist_ok=True)
    for resource_id, image in images.items():
        image.save(output / f"{resource_id}.png")
    print(f"Extracted {len(images)} resource icons to {output}")


if __name__ == "__main__":
    main()
