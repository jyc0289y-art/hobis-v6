/* HOBIS DATABASE MODULE v3.6
   파일명: hobis_db.js

   [데이터 검증 소스]
   1. QSA: QSA Global MAN-027 (Revision Sep 2022)
      - Table 6: Source Output (R/hr/Ci @ 1m) -> mSv 변환 (x10)
      - Table 7: Approximate Half Value Thickness (Inches/mm)
   2. ICRP107: Smith & Stabin (2012)
   3. NIST XCOM: Photon Cross Sections Database (gamma HVL for Water/PE/Paraffin)
   4. Alizadeh Rahvar et al., Int. J. Radiat. Res., 18(2):381-387, 2020
      - Cf-252 HVL (MCNPX): Lead γ=7.7mm, Concrete γ=48mm,
        PE n=18.5mm, Water n=21.6mm

   [단위]
   - Gamma: mSv·m²/h·Ci (= R·cm²/(mCi·h) × 10)
   - HVL: mm
   - HL: d(Days), y(Years)

   [QSA vs ICRP107 감마상수(Γ) 차이 원인]
   두 DB의 Γ 값이 다른 이유는 산출 방법론의 차이에 기인한다:

   ● QSA (MAN-027): 제조사 실측 기반. 특정 소스 캡슐(encapsulation) 조건에서
     측정한 Air Kerma Rate를 R 단위로 제시. 캡슐에 의한 자기차폐(self-shielding)와
     저에너지 감마선 필터링이 반영된 실용값.
     → 일반적으로 bare source 이론값보다 낮음 (캡슐이 저에너지선 흡수)
     → 예: Ir-192 QSA=4.80 vs ICRP107=4.60 (QSA가 4% 높음 — 캡슐 보정 차이)

   ● ICRP107 (Smith & Stabin 2012): ICRP Publication 107 붕괴 데이터에서
     모든 감마선/X선의 에너지×방출률을 적분하여 이론적 Γ를 계산.
     Unfiltered(bare) 선원 기준이므로 캡슐 효과 미반영.
     → 저에너지 기여가 큰 핵종(Yb-169 등)에서 QSA 대비 큰 차이 발생
     → 예: Yb-169 QSA=1.25 vs ICRP107=1.85 (ICRP가 48% 높음 — 저에너지선 포함)

   ● 핵종별 차이 요약:
     Ir-192: QSA 4.80 vs ICRP 4.60 (QSA +4%) — 캡슐 보정 방향 차이
     Se-75:  QSA 2.03 vs ICRP 2.03 (일치) — 중간 에너지, 캡슐 효과 미미
     Yb-169: QSA 1.25 vs ICRP 1.85 (ICRP +48%) — 저에너지(93keV) 기여 큼
     Co-60:  QSA 13.0 vs ICRP 12.9 (QSA +1%) — 고에너지, 캡슐 효과 거의 없음
     Cs-137: QSA 3.20 vs ICRP 3.43 (ICRP +7%) — 단일선 662keV, Ba X선 기여 차이

   ● 실무 권장:
     - 차폐 설계(보수적 평가): QSA 값 또는 둘 중 큰 값 사용
     - 이론 계산/연구: ICRP107 값 사용
     - 두 값의 차이가 10% 이내이면 실무상 유의미하지 않음
*/

const GLOBAL_DB = {
    // [1] QSA Global (MAN-027 Table 6 & 7 Strict Compliance)
    // 제조사 실측 기반 — 캡슐된 소스의 실용적 감마상수
    "QSA": [
        {
            id: "Ir-192",
            hl: 74, unit: "d",    // Manual 1.3: 74 days
            gamma: 4.80,          // Manual Table 6: 0.48 R -> 4.8 mSv
            hvl: {                // QSA MAN-027 broad-beam (기본값)
                "Lead": 5.1, "Steel": 13.0, "Concrete": 43.2, "Tungsten": 3.3, "DU": 1.3,
                "LeadGlass": 14.0, "Water": 48.0, "Polyethylene": 51.0, "Paraffin": 52.0, "Aluminum": 27.0
            },
            hvl_nist: {           // NIST XCOM narrow-beam @370keV avg — HVL=ln2/(μ/ρ×ρ)
                "Lead": 2.3, "Steel": 8.5, "Concrete": 24.6, "Tungsten": 1.5, "DU": 0.6,
                "LeadGlass": 7.8, "Water": 63.0, "Polyethylene": 67.0, "Paraffin": 68.0, "Aluminum": 27.0
            }
        },
        {
            id: "Se-75",
            hl: 120, unit: "d",   // Manual 1.3
            gamma: 2.03,          // Manual Table 6: 0.203 R -> 2.03 mSv
            hvl: {
                "Lead": 1.0, "Steel": 8.0, "Concrete": 30.0, "Tungsten": 0.8, "DU": 0.6,
                "LeadGlass": 2.8, "Water": 38.0, "Polyethylene": 40.0, "Paraffin": 41.0, "Aluminum": 21.0
            },
            hvl_nist: {           // NIST XCOM narrow-beam @215keV avg
                "Lead": 0.7, "Steel": 5.6, "Concrete": 19.0, "Tungsten": 0.4, "DU": 0.3,
                "LeadGlass": 2.0, "Water": 53.0, "Polyethylene": 56.0, "Paraffin": 57.0, "Aluminum": 21.0
            }
        },
        {
            id: "Yb-169",
            hl: 32, unit: "d",    // Manual 1.3
            gamma: 1.25,          // Manual Table 6: 0.125 R -> 1.25 mSv
            hvl: {
                "Lead": 0.8, "Steel": 4.3, "Concrete": 29.0, "Tungsten": 0.25, "DU": 0.2,
                "LeadGlass": 2.2, "Water": 35.0, "Polyethylene": 37.0, "Paraffin": 38.0, "Aluminum": 15.0
            },
            hvl_nist: {           // NIST XCOM narrow-beam @93keV avg
                "Lead": 0.09, "Steel": 2.0, "Concrete": 14.0, "Tungsten": 0.06, "DU": 0.04,
                "LeadGlass": 0.3, "Water": 40.0, "Polyethylene": 42.0, "Paraffin": 43.0, "Aluminum": 15.0
            }
        },
        {
            id: "Co-60",
            hl: 5.27, unit: "y",
            gamma: 13.0,          // Manual Table 6: 1.30 R -> 13.0 mSv
            hvl: {
                "Lead": 12.7, "Steel": 21.0, "Concrete": 61.0, "Tungsten": 7.9, "DU": 6.8,
                "LeadGlass": 33.0, "Water": 111.0, "Polyethylene": 118.0, "Paraffin": 119.0, "Aluminum": 47.0
            },
            hvl_nist: {           // NIST XCOM narrow-beam @1.25MeV avg
                "Lead": 10.4, "Steel": 16.4, "Concrete": 49.0, "Tungsten": 6.3, "DU": 5.4,
                "LeadGlass": 27.0, "Water": 108.0, "Polyethylene": 115.0, "Paraffin": 116.0, "Aluminum": 47.0
            }
        },
        {
            id: "Cs-137",
            hl: 30.0, unit: "y",
            gamma: 3.20,          // Manual Table 6: 0.32 R -> 3.20 mSv
            hvl: {
                "Lead": 6.4, "Steel": 22.9, "Concrete": 76.2, "Tungsten": 5.7, "DU": 3.2,
                "LeadGlass": 17.0, "Water": 87.0, "Polyethylene": 93.0, "Paraffin": 94.0, "Aluminum": 34.0
            },
            hvl_nist: {           // NIST XCOM narrow-beam @662keV
                "Lead": 5.5, "Steel": 11.2, "Concrete": 35.0, "Tungsten": 4.5, "DU": 2.5,
                "LeadGlass": 14.5, "Water": 80.0, "Polyethylene": 85.0, "Paraffin": 86.0, "Aluminum": 34.0
            }
        }
    ],

    // [2] ICRP 107 (Smith & Stabin 2012)
    // Bare(unfiltered) 선원 기준 이론값 — 캡슐 자기차폐 미반영
    // Γ: ICRP Pub.107 붕괴 데이터에서 전 에너지 감마/X선 적분
    // HVL: ICRP 스펙트럼 기반 → 저에너지선 포함으로 Pb HVL이 QSA보다 낮음
    //       (저에너지선이 Pb에 더 잘 흡수되므로 실효 HVL 감소)
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