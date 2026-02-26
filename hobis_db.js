/* HOBIS DATABASE MODULE v3.4
   파일명: hobis_db.js
   
   [데이터 검증 소스]
   1. QSA: QSA Global MAN-027 (Revision Sep 2022)
      - Table 6: Source Output (R/hr/Ci @ 1m) -> mSv 변환 (x10)
      - Table 7: Approximate Half Value Thickness (Inches/mm)
   2. ICRP107: Smith & Stabin (2012)
   
   [단위]
   - Gamma: mSv·m²/h·Ci 
   - HVL: mm
   - HL: d(Days), y(Years)
*/

const GLOBAL_DB = {
    // [1] QSA Global (MAN-027 Table 6 & 7 Strict Compliance)
    "QSA": [
        { 
            id: "Ir-192", 
            hl: 74, unit: "d",    // Manual 1.3: 74 days
            gamma: 4.80,          // Manual Table 6: 0.48 R -> 4.8 mSv
            hvl: { 
                "Lead": 5.1,      // Manual Table 7: 0.200"
                "Steel": 13.0,    // Manual Table 7: 0.512"
                "Concrete": 43.2, // Manual Table 7: 1.700"
                "Tungsten": 3.3,  // Manual Table 7: 0.130"
                "DU": 1.3         // Manual Table 7: 0.050" 
            } 
        },
        { 
            id: "Se-75", 
            hl: 120, unit: "d",   // Manual 1.3
            gamma: 2.03,          // Manual Table 6: 0.203 R -> 2.03 mSv
            hvl: { 
                "Lead": 1.0,      // Manual Table 7: 0.039"
                "Steel": 8.0,     // Manual Table 7: 0.315"
                "Concrete": 30.0, // Manual Table 7: 1.180"
                "Tungsten": 0.8,  // Manual Table 7: 0.032"
                "DU": 0.6         // Not listed in Table 7 DU row, using calc/approx from density
            } 
        },
        { 
            id: "Yb-169", 
            hl: 32, unit: "d",    // Manual 1.3
            gamma: 1.25,          // Manual Table 6: 0.125 R -> 1.25 mSv
            hvl: { 
                "Lead": 0.8,      // Manual Table 7: 0.032"
                "Steel": 4.3,     // Manual Table 7: 0.170"
                "Concrete": 29.0, // Manual Table 7: 1.140"
                "Tungsten": 0.25, // Approx (Not explicitly in W row for Yb)
                "DU": 0.2         // Approx
            } 
        },
        { 
            id: "Co-60", 
            hl: 5.27, unit: "y", 
            gamma: 13.0,          // Manual Table 6: 1.30 R -> 13.0 mSv
            hvl: { 
                "Lead": 12.7,     // Manual Table 7: 0.500"
                "Steel": 21.0,    // Manual Table 7: 0.827"
                "Concrete": 61.0, // Manual Table 7: 2.400"
                "Tungsten": 7.9,  // Manual Table 7: 0.310"
                "DU": 6.8         // Manual Table 7: 0.270"
            } 
        },
        { 
            id: "Cs-137", 
            hl: 30.0, unit: "y", 
            gamma: 3.20,          // Manual Table 6: 0.32 R -> 3.20 mSv
            hvl: { 
                "Lead": 6.4,      // Manual Table 7: 0.250"
                "Steel": 22.9,    // Manual Table 7: 0.900"
                "Concrete": 76.2, // Manual Table 7: 3.00"
                "Tungsten": 5.7,  // Manual Table 7: 0.225"
                "DU": 3.2         // Manual Table 7: 0.125"
            } 
        }
    ],

    // [2] ICRP 107 (Smith & Stabin 2012)
    // Note: Ir-192 Unfiltered source shows significantly lower HVL due to soft spectrum
    "ICRP107": [
        { id: "Ir-192", hl: 73.83, unit: "d", gamma: 4.60, hvl: { "Lead": 2.67 } },
        { id: "Se-75",  hl: 119.8, unit: "d", gamma: 2.03, hvl: { "Lead": 1.00 } },
        { id: "Yb-169", hl: 32.0,  unit: "d", gamma: 1.85, hvl: { "Lead": 0.60 } },
        { id: "Co-60",  hl: 5.27,  unit: "y", gamma: 12.9, hvl: { "Lead": 15.6 } },
        { id: "Cs-137", hl: 30.17, unit: "y", gamma: 3.43, hvl: { "Lead": 7.19 } },
        
        // Medical / Research
        { id: "Tc-99m", hl: 6.01,  unit: "h", gamma: 0.76, hvl: { "Lead": 0.30 } },
        { id: "I-131",  hl: 8.02,  unit: "d", gamma: 2.20, hvl: { "Lead": 2.74 } },
        { id: "F-18",   hl: 109.7, unit: "m", gamma: 5.68, hvl: { "Lead": 4.95 } },
        { id: "I-123",  hl: 13.2,  unit: "h", gamma: 1.78, hvl: { "Lead": 0.07 } },
        { id: "Ga-67",  hl: 3.26,  unit: "d", gamma: 0.80, hvl: { "Lead": 0.86 } },
        { id: "Lu-177", hl: 6.65,  unit: "d", gamma: 0.18, hvl: { "Lead": 0.54 } },
        { id: "Am-241", hl: 432.2, unit: "y", gamma: 0.15, hvl: { "Lead": 0.11 } },
        { id: "Na-22",  hl: 2.6,   unit: "y", gamma: 11.8, hvl: { "Lead": 9.20 } }
    ]
};