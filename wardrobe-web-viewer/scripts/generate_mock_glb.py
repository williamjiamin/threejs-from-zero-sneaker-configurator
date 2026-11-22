#!/usr/bin/env python3
"""Original deterministic, dependency-free binary glTF fixture generator (MIT)."""
from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / "game_module"
GLB_HEADER = struct.Struct("<III")
CHUNK_HEADER = struct.Struct("<II")


class Builder:
    def __init__(self):
        self.binary = bytearray()
        self.views: list[dict] = []
        self.accessors: list[dict] = []
        self.meshes: list[dict] = []
        self.nodes: list[dict] = []
        self.materials = [
            self.make_material("fabric", "#667e99", 0.92, 0.0),
            self.make_material("trim", "#e5dfd2", 0.75, 0.0),
            self.make_material("hardware", "#adb5bd", 0.33, 0.65),
        ]
        self.material_ids = {mat["name"]: i for i, mat in enumerate(self.materials)}

    @staticmethod
    def make_material(name: str, color: str, roughness: float, metalness: float) -> dict:
        rgb = [round(int(color[i:i+2], 16) / 255.0, 7) for i in (1, 3, 5)]
        return {
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": rgb + [1.0],
                "roughnessFactor": roughness,
                "metallicFactor": metalness,
            },
            "doubleSided": False,
        }

    def pack(self, content: bytes, target: int) -> int:
        while len(self.binary) % 4:
            self.binary.append(0)
        start = len(self.binary)
        self.binary.extend(content)
        view_idx = len(self.views)
        self.views.append({"buffer": 0, "byteOffset": start, "byteLength": len(content), "target": target})
        return view_idx

    def add_accessor(self, content: bytes, target: int, component_type: int,
                     count: int, accessor_type: str, bounds=None) -> int:
        idx = len(self.accessors)
        accessor = {
            "bufferView": self.pack(content, target),
            "byteOffset": 0,
            "componentType": component_type,
            "count": count,
            "type": accessor_type,
        }
        if bounds:
            accessor["min"] = bounds[0]
            accessor["max"] = bounds[1]
        self.accessors.append(accessor)
        return idx

    def add_tapered_box(self, name: str, material: str, center_x: float,
                        y_bottom: float, y_top: float, hx_bottom: float,
                        hx_top: float, hz_bottom: float, hz_top: float,
                        center_z: float = 0.0) -> None:
        # Four bottom corners, then top corners. Outward CCW faces.
        points = [
            (center_x - hx_bottom, y_bottom, center_z - hz_bottom),
            (center_x + hx_bottom, y_bottom, center_z - hz_bottom),
            (center_x + hx_bottom, y_bottom, center_z + hz_bottom),
            (center_x - hx_bottom, y_bottom, center_z + hz_bottom),
            (center_x - hx_top, y_top, center_z - hz_top),
            (center_x + hx_top, y_top, center_z - hz_top),
            (center_x + hx_top, y_top, center_z + hz_top),
            (center_x - hx_top, y_top, center_z + hz_top),
        ]
        # Corner order is counterclockwise when looking at each outward face.
        faces = [
            (0, 1, 2, 3),  # bottom (outward -Y)
            (7, 6, 5, 4),  # top (outward +Y)
            (4, 5, 1, 0),  # back (outward -Z)
            (6, 7, 3, 2),  # front (outward +Z)
            (5, 6, 2, 1),  # right (outward +X)
            (7, 4, 0, 3),  # left (outward -X)
        ]
        positions: list[float] = []
        normals: list[float] = []
        indices: list[int] = []
        for face in faces:
            p, q, r = [points[i] for i in face[:3]]
            u = tuple(q[i] - p[i] for i in range(3))
            v = tuple(r[i] - p[i] for i in range(3))
            n = (u[1] * v[2] - u[2] * v[1],
                 u[2] * v[0] - u[0] * v[2],
                 u[0] * v[1] - u[1] * v[0])
            mag = math.sqrt(sum(x*x for x in n))
            unit = tuple(x / mag for x in n)
            start = len(positions) // 3
            for vertex in face:
                positions.extend(points[vertex])
                normals.extend(unit)
            indices.extend((start, start + 1, start + 2, start, start + 2, start + 3))
        coords = [positions[i::3] for i in range(3)]
        bounds = ([min(axis) for axis in coords], [max(axis) for axis in coords])
        pos = self.add_accessor(struct.pack(f"<{len(positions)}f", *positions),
                                34962, 5126, len(positions)//3, "VEC3", bounds)
        normal = self.add_accessor(struct.pack(f"<{len(normals)}f", *normals),
                                   34962, 5126, len(normals)//3, "VEC3")
        index = self.add_accessor(struct.pack(f"<{len(indices)}H", *indices),
                                  34963, 5123, len(indices), "SCALAR")
        mesh_idx = len(self.meshes)
        self.meshes.append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": pos, "NORMAL": normal},
                "indices": index,
                "material": self.material_ids[material],
                "mode": 4,
            }],
        })
        self.nodes.append({"name": name, "mesh": mesh_idx})

    def binary_glb(self) -> bytes:
        gltf = {
            "asset": {"version": "2.0", "generator": "Original procedural garment fixture"},
            "scene": 0,
            "scenes": [{"nodes": list(range(len(self.nodes)))}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.binary)}],
        }
        j = json.dumps(gltf, sort_keys=True, separators=(",", ":")).encode("utf-8")
        j += b" " * ((-len(j)) % 4)
        binary = bytes(self.binary) + bytes((-len(self.binary)) % 4)
        length = GLB_HEADER.size + CHUNK_HEADER.size * 2 + len(j) + len(binary)
        return (GLB_HEADER.pack(0x46546C67, 2, length) +
                CHUNK_HEADER.pack(len(j), 0x4E4F534A) + j +
                CHUNK_HEADER.pack(len(binary), 0x004E4942) + binary)


def make_field_coat() -> bytes:
    builder = Builder()
    builder.add_tapered_box("coat_hem", "fabric", 0, 0.0, 0.40, .46, .36, .23, .17)
    builder.add_tapered_box("coat_torso", "fabric", 0, .39, 1.45, .36, .34, .17, .16)
    builder.add_tapered_box("coat_shoulder", "fabric", 0, 1.36, 1.53, .42, .38, .17, .15)
    builder.add_tapered_box("coat_sleeve_left", "fabric", -.48, .69, 1.37, .15, .17, .15, .16)
    builder.add_tapered_box("coat_sleeve_right", "fabric", .48, .69, 1.37, .15, .17, .15, .16)
    builder.add_tapered_box("coat_collar", "trim", 0, 1.48, 1.68, .26, .20, .20, .18)
    builder.add_tapered_box("coat_front_edge_left", "trim", -.045, .14, 1.40, .014, .014, .018, .018, .187)
    builder.add_tapered_box("coat_front_edge_right", "trim", .045, .14, 1.40, .014, .014, .018, .018, .187)
    builder.add_tapered_box("coat_belt", "trim", 0, .65, .72, .38, .38, .195, .195)
    builder.add_tapered_box("coat_buckle", "hardware", 0, .65, .73, .058, .058, .012, .012, .214)
    builder.add_tapered_box("coat_clasp", "hardware", 0, 1.05, 1.09, .035, .035, .014, .014, .209)
    return builder.binary_glb()


def make_travel_robe() -> bytes:
    builder = Builder()
    builder.add_tapered_box("robe_skirt", "fabric", 0, 0.0, .77, .56, .37, .28, .18)
    builder.add_tapered_box("robe_body", "fabric", 0, .75, 1.46, .37, .35, .18, .19)
    builder.add_tapered_box("robe_sleeve_left", "fabric", -.51, .82, 1.30, .21, .17, .19, .16)
    builder.add_tapered_box("robe_sleeve_right", "fabric", .51, .82, 1.30, .21, .17, .19, .16)
    builder.add_tapered_box("robe_neck", "trim", 0, 1.43, 1.68, .23, .17, .21, .16)
    builder.add_tapered_box("robe_border_left", "trim", -.24, 0.0, .17, .042, .042, .036, .036, .26)
    builder.add_tapered_box("robe_border_right", "trim", .24, 0.0, .17, .042, .042, .036, .036, .26)
    builder.add_tapered_box("robe_sash", "trim", 0, .85, .91, .38, .38, .205, .205)
    builder.add_tapered_box("robe_sash_clasp", "hardware", 0, .85, .92, .08, .08, .012, .012, .225)
    return builder.binary_glb()


def fixtures() -> dict[str, bytes]:
    return {"field_coat.glb": make_field_coat(), "travel_robe.glb": make_travel_robe()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT,
                        help="Target root containing assets/garments")
    parser.add_argument("--check", action="store_true", help="Compare against deterministic bytes")
    args = parser.parse_args()
    folder = args.root / "assets" / "garments"
    good = True
    for name, content in fixtures().items():
        path = folder / name
        if args.check:
            okay = path.is_file() and path.read_bytes() == content
            print(f"{'PASS' if okay else 'FAIL'} fixture_bytes {name}")
            good &= okay
        else:
            folder.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            print(f"PASS fixture_generated {name} bytes={len(content)}")
    print(f"ALL={'true' if good else 'false'}")
    return 0 if good else 1


if __name__ == "__main__":
    sys.exit(main())
