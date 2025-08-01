In timber structures, **global imperfections** refer to assumed deviations from the perfect geometry of the structure—essentially, initial out-of-straightness, lack-of-plumb, or curvature of members **before any loads are applied**. These imperfections must be considered in structural analysis, especially when assessing stability (e.g., buckling, lateral torsional buckling of beams, or sway of frames).\n +
\n +
**According to EN 1995-1-1:2004 (Eurocode 5)**, the requirements for considering global imperfections in timber structures are found mainly in Section 5 (Structural analysis), particularly in **clause 5.4.4 (Plane frames and arches)**.\n +
\n +
### Key Points from EN 1995-1-1:2004 (see page 10 & 11 above):\n +
\n +
#### Initial Imperfections to be Considered\n +
\n +
- For **plane frames and arches**, the **effects of induced deflection on internal forces and moments** shall be taken into account.\n +
- The **imperfect shape of the structure** should be assumed to correspond to:\n +
    - An **initial angle φ of inclination** (out-of-plumb) to the structure or relevant parts.\n +
    - **An initial sinusoidal curvature** between the nodes of the structure with a maximum eccentricity \\(e\\).\n +
\n +
#### Minimum values for imperfections:\n +
\n +
- **Angle of inclination** (φ, in radians) should, as a minimum, be taken as:\n +
\n +
    \\[\n +
    φ = 0.005 \\quad \\text{for} \\quad h \\leq 5\\, \\text{m}\n +
    \\]\n +
\n +
    \\[\n +
    φ = 0.005 \\sqrt{5/h} \\quad \\text{for} \\quad h > 5\\, \\text{m}\n +
    \\]\n +
\n +
    where \\( h \\) is the height of the structure or the length of the member, in meters.\n +
\n +
- **Lateral eccentricity** (e):\n +
\n +
    \\[\n +
    e = 0.0025 \\ell\n +
    \\]\n +
\n +
    where \\( \\ell \\) is the length of the relevant part of the structure.\n +
\n +
### Illustrated in EN 1995-1-1:2004\n +
\n +
See **Figures 5.2 and 5.3** (page 10-11 above):\n +
- These show possible assumed initial deviations: sway angles and sinusoidal out-of-plumbness in frames or arches.\n +
\n +
---\n +
\n +
### **Summary Table: Minimum Global Imperfections to Consider in Analysis**\n +
\n +
| Imperfection Type      | Expression                               | Where Used      |\n +
|-----------------------|-------------------------------------------|-----------------|\n +
| Out-of-plumb angle φ  | φ = 0.005 (for \\(h \\leq 5\\) m)            | Frames/arches   |\n +
|                       | φ = 0.005 √(5/h) (for \\(h > 5\\) m)        |                 |\n +
| Sinusoidal eccentricity| e = 0.0025 × ℓ (ℓ = member/structure length) | Frames/arches   |\n +
\n +
---\n +
\n +
### **Application**\n +
These global imperfections should be incorporated in the **second-order (geometrically non-linear) analysis** or considered in the stability checks (e.g., buckling calculations) for timber frames, arches, and columns.\n +
\n +
**In summary:**\n +
> The principal global imperfections to be considered in the structural analysis of timber structures according to EN 1995-1-1:2004 are an initial out-of-plumb angle (φ) and a sinusoidal out-of-straightness (e), as described above.\n +
\n +
If you need a full worked example or specific code references for a frame or arch, let me know!
