# Character assets

The project contains four self-authored GLB files in this directory. They were created
in Blender 5.2.3 LTS on 2026-10-31 from primitive meshes and exported as glTF binary.
No external assets, downloads, or third-party licenses are used.

| File | Role | Source / rights | Required convention |
|---|---|---|---|
| `squad_engineer.glb` | Engineer | Self-authored in Blender; no external license | 1 unit = 1 metre; feet near Y=0; faces +Z |
| `squad_rifleman.glb` | Rifleman | Self-authored in Blender; no external license | same convention |
| `squad_machinegunner.glb` | Machine gunner | Self-authored in Blender; no external license | same convention |
| `enemy_basic.glb` | Enemy, cloned 8 times | Self-authored in Blender; no external license | same convention |

The models use simple low-poly cubes, cylinders, cones, and spheres. They are intentionally
small and readable for the Part C prototype rather than being realistic character assets.
The enemy file is loaded once and cloned eight times by the runtime loader.

Semantic bone names in every file: `Hips`, `Spine`, `Head`, `UpperArm.L`, `UpperArm.R`,
`UpperLeg.L`, `UpperLeg.R`. There are no animation clips yet; the bones are provided for
future animation and ragdoll integration. The loader clones the scene once per unit; it does
not download multiple enemy copies.
