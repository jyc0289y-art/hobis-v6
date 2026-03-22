// --- HOBIS Cf-252 CALCULATION ENGINE ---
// Cf-252 선량평가 및 방사화평가 계산기
// Based on: 호진산업기연(주) 방사선안전보고서 REV13 (6차 보완)

const CF252 = {
    // === Cf-252 Nuclear Data ===
    HALF_LIFE_Y: 2.65,
    BF_SF: 0.03092,
    NU: 3.765,
    NEUTRON_MEAN_ENERGY_MEV: 2.14,
    GAMMA_MEAN_ENERGY_MEV: 1.0,

    // === 감마상수 (Smith & Stabin 2012, ICRP-107) ===
    GAMMA_CONST_TRAD: 2.31,       // R·cm²/(mCi·h)
    // 안전보고서(HJSR-01 REV.13 p.95): 2.31×10⁻³ mSv·m²/(mCi·h) = 23.1 mSv·cm²/(mCi·h)
    // 1R = 1cGy = 10mSv 단순환산 (보고서 승인 기준, F_FACTOR 미적용)
    get GAMMA_CONST_MSV() {
        return this.GAMMA_CONST_TRAD * 10;
    },

    // === 중성자 선량률 환산 ===
    H_PHI: 332.9,                  // pSv·cm²/neutron
    DECAY_RATE_PER_MCI: 3.7e7,     // dis/s per mCi

    // 중성자 방출률: λ × BF_SF × ν
    get NEUTRON_RATE_PER_MCI() {
        return this.DECAY_RATE_PER_MCI * this.BF_SF * this.NU;
    },

    // 1cm에서 중성자 선속밀도
    get PHI_1CM_PER_MCI() {
        return this.NEUTRON_RATE_PER_MCI / (4 * Math.PI);
    },

    // 중성자 선량률 환산계수 [mSv·cm²/(mCi·h)]
    // Φ(1cm) × H/Φ × 3600 × 1e3 (pSv→mSv: 1e-9, ×1e3 for mSv→μSv 보정... 아니, 단위 정리)
    // Ḣ_n(1cm) = Φ × H/Φ = n/(cm²·s) × pSv·cm²/n = pSv/s per mCi at 1cm
    // → mSv/h: × 3600 × 1e-9
    // → mSv·cm²/(mCi·h): 이 값 자체가 1cm 기준이므로 × 1² = 그대로
    get NEUTRON_CONST_MSV() {
        const pSv_per_s = this.PHI_1CM_PER_MCI * this.H_PHI;
        return pSv_per_s * 3600 * 1e-9; // mSv·cm²/(mCi·h)
    },

    // === HVL 값 (cm) — 6차 보완 최종 채택 + RT룸 재료 확장 ===
    HVL_GAMMA: {
        'Pb': 0.82,
        'Concrete': 5.03,
        'Water': 10.0,       // μ/ρ≈0.0707 cm²/g @1MeV, ρ=1.0 → HVL≈9.8cm (보수적 10cm)
        'Paraffin': 11.0,    // μ/ρ≈0.065 cm²/g @1MeV, ρ=0.9 → HVL≈11cm
    },
    HVL_NEUTRON: {
        'PE': 1.85,
        'Pb': 3.45,
        'Concrete': 3.03,
        'Water': 2.3,        // H밀도 6.69e22/cm³ (PE 대비 0.82배) → HVL≈1.85/0.82≈2.3cm
        'Paraffin': 1.9,     // H밀도 8.0e22/cm³ (PE와 유사) → HVL≈1.9cm
    },

    // === 방사화 관련 (Al-27 → Al-28) ===
    AL28_HALF_LIFE_S: 134.5,
    get AL28_DECAY_CONST() {
        return Math.LN2 / this.AL28_HALF_LIFE_S;
    },
    // Al-28 감마상수 (Smith & Stabin 2012)
    AL28_GAMMA_CONST_TRAD: 8.37,   // R·cm²/(mCi·h)
    AL28_F_FACTOR: 0.876,           // cGy/R
    get AL28_GAMMA_CONST_MSV() {
        return this.AL28_GAMMA_CONST_TRAD * this.AL28_F_FACTOR * 10;
    },

    // Al-27 (n,γ) 반응단면적 @ ~2 MeV (빠른 중성자 대역)
    // ENDF/B 기반: 5.12×10⁻⁴ barn (안전보고서 HJSR-01 REV.13 p.97)
    AL27_CROSS_SECTION: 5.12e-28,   // cm² (0.512 mb)

    // === 운반용기 ===
    CONTAINERS: {
        'STC-100': {
            name: 'STC-100',
            maxActivity_mCi: 54,
            shielding: { PE: 24.65 },  // cm (246.5 mm → cm)
            diameter_mm: 606,
            height_mm: 874,
            weight_kg: 192,
        },
        'UKTIB-313': {
            name: 'УКТIIB(У)-313-1',
            maxActivity_mCi: null,     // 별도 장전량 제한 없음 (운반물 기준)
            shielding: {},             // 차폐 정보 별도 입력
            diameter_mm: 720,
            height_mm: 920,
            weight_kg: 460,
        }
    },

    // === 선량률 기준 (μSv/h) ===
    LIMITS: {
        MANAGED_INNER: { value: 25, label: '관리구역 내부 (25 μSv/h)' },
        MANAGED_OUTER: { value: 10, label: '관리구역 외부 (10 μSv/h)' },
        PUBLIC: { value: 1, label: '일반인 경계 (1 μSv/h)' },
        CONTAINER_SURFACE: { value: 2000, label: '운반물 표면 (2 mSv/h)' },
        CONTAINER_1M: { value: 100, label: '운반물 1m (0.1 mSv/h)' },
    },

    // === 프리셋 시나리오 ===
    // 거리/차폐: HJSR-01 REV.13 안전보고서 기반
    // 저장시설 내부: 9,200×3,600×6,000mm, 외벽 콘크리트 1,200mm
    // 핫셀 (p.70 제원): 내부 2,650×1,800×4,550mm/셀
    //   C1-DP1,3,4 방향: 콘크리트 벽 1,200mm
    //   C1-DP2 방향: 콘크리트 벽 1,350mm
    //   천장: 콘크리트 600mm
    //   저장 시 콘크리트 경로 (저장함 구조체 포함): DP1,3,4 = 1,615mm (p.95)
    //   취급 시 콘크리트 경로 (벽체만): DP2 = 1,350mm (p.96)
    // S-DP = 선량평가점 (Safety-Dose evaluation Point)
    PRESETS: [
        {
            id: 'stc100_x4_surface',
            name: '퍼 STC-100×4 표면 (S-DP01)',
            description: '51mCi×4, 용기 표면 — 보고서 p.58: 6.54×10⁻⁹ mSv/h',
            mode: 'storage',
            sources: [
                { activity_mCi: 51, distance_cm: 30, container: 'STC-100' },
                { activity_mCi: 51, distance_cm: 50, container: 'STC-100' },
                { activity_mCi: 51, distance_cm: 70, container: 'STC-100' },
                { activity_mCi: 51, distance_cm: 90, container: 'STC-100' },
            ],
            shielding: [],
            extraShielding: [],
            reportRef: 'S-DP01(퍼), p.58: 6.54×10⁻⁹ mSv/h',
        },
        {
            id: 'stc100_x4_wall',
            name: '퍼 STC-100×4 벽외부 (S-DP02~05)',
            description: '51mCi×4, 콘크리트 벽 120cm 외부 — 보고서 p.58: 8.77×10⁻⁹ mSv/h',
            mode: 'storage',
            sources: [
                { activity_mCi: 51, distance_cm: 300, container: 'STC-100' },
                { activity_mCi: 51, distance_cm: 320, container: 'STC-100' },
                { activity_mCi: 51, distance_cm: 340, container: 'STC-100' },
                { activity_mCi: 51, distance_cm: 360, container: 'STC-100' },
            ],
            shielding: [],
            extraShielding: [
                { material: 'Concrete', thickness_cm: 120 },
            ],
            reportRef: 'S-DP02~05(퍼), p.58: 8.77×10⁻⁹ mSv/h',
        },
        {
            id: 'uktib_x2_surface',
            name: '허 УКТIIB×2 표면 (S-DP01)',
            description: '97mCi×2, 용기 표면 — 보고서 p.58: 5.99×10⁻⁹ mSv/h',
            mode: 'storage',
            sources: [
                { activity_mCi: 97, distance_cm: 36, container: 'UKTIB-313' },
                { activity_mCi: 97, distance_cm: 56, container: 'UKTIB-313' },
            ],
            shielding: [],
            extraShielding: [],
            reportRef: 'S-DP01(허), p.58: 5.99×10⁻⁹ mSv/h',
        },
        {
            id: 'uktib_x2_wall',
            name: '허 УКТIIB×2 벽외부 (S-DP02~05)',
            description: '97mCi×2, 콘크리트 벽 120cm 외부 — 보고서 p.58: 7.92×10⁻⁹ mSv/h',
            mode: 'storage',
            sources: [
                { activity_mCi: 97, distance_cm: 300, container: 'UKTIB-313' },
                { activity_mCi: 97, distance_cm: 320, container: 'UKTIB-313' },
            ],
            shielding: [],
            extraShielding: [
                { material: 'Concrete', thickness_cm: 120 },
            ],
            reportRef: 'S-DP02~05(허), p.58: 7.92×10⁻⁹ mSv/h',
        },
        // === 핫셀 취급 프리셋 (나선원 노출, 벽 내면 밀착 가정) ===
        // p.70 제원: DP1,3,4 콘크리트 1,200mm / DP2 콘크리트 1,350mm / 천장 600mm
        // p.96: 취급 시 벽체 차폐만 적용, 납 0mm, 평가점 벽 외면 +100mm
        // 천장: 선원 바닥 가정, 내부높이 4,550mm + 콘크리트 600mm + 평가점 100mm
        {
            id: 'hotcell_handling_dp134',
            name: '핫셀 취급 2.7Ci — C1-DP1,3,4 벽외부',
            description: '나선원 노출, 벽 내면 밀착, 콘크리트 1,200mm + 평가점 100mm — p.70 제원 기반',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 130, container: null },
            ],
            shielding: [
                { material: 'Concrete', thickness_cm: 120 },
            ],
            extraShielding: [],
            reportRef: '핫셀 취급 DP1,3,4 — 콘크리트 1,200mm, 평가거리 1,300mm (p.70 제원)',
        },
        {
            id: 'hotcell_handling_dp2',
            name: '핫셀 취급 2.7Ci — C1-DP2 벽외부',
            description: '나선원 노출, 벽 내면 밀착, 콘크리트 1,350mm + 평가점 100mm — 보고서 p.96',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 145, container: null },
            ],
            shielding: [
                { material: 'Concrete', thickness_cm: 135 },
            ],
            extraShielding: [],
            reportRef: 'C1-DP2 콘크리트 1,350mm, 평가거리 1,450mm (p.96): γ=2.47×10⁻⁸ + n=2.04×10⁻¹² mSv/h',
        },
        {
            id: 'hotcell_handling_ceiling',
            name: '핫셀 취급 2.7Ci — 천장',
            description: '나선원 노출, 선원 바닥 가정, 내부높이 4,550mm + 천장 콘크리트 600mm + 평가점 100mm',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 525, container: null },
            ],
            shielding: [
                { material: 'Concrete', thickness_cm: 60 },
            ],
            extraShielding: [],
            reportRef: '핫셀 취급 천장 — 바닥 선원 가정, 4,550+600+100=5,250mm (p.70 제원)',
        },

        // === 성능시험실(T) RT룸 내 아크릴+물 핫셀 프리셋 ===
        // 구조: 아크릴 수조(물) + 납(벽/천장) 또는 납유리(창)
        // 핫셀 내부: 80×80×100cm, 선원 중앙(내벽까지 40cm)
        // 평가점: 핫셀 외벽에서 30cm (관리구역 내부 ≤ 25 μSv/h)
        {
            id: 'rt_hotcell_wall_54',
            name: 'RT핫셀 벽 물30+납5cm (54mCi)',
            description: 'RT룸 내 아크릴 수조 핫셀 — 벽체: 물30cm+납5cm, 54mCi 취급',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 105, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 30 },
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: 'RT핫셀 벽체 — 물30(n)+납5(γ), 내벽40+벽35+외30=105cm, ≈0.29 μSv/h',
        },
        {
            id: 'rt_hotcell_wall_2700',
            name: 'RT핫셀 벽 물30+납5cm (2.7Ci)',
            description: 'RT룸 내 아크릴 수조 핫셀 — 벽체: 물30cm+납5cm, 2.7Ci 저장/취급',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 105, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 30 },
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: 'RT핫셀 벽체 — 물30(n)+납5(γ), 내벽40+벽35+외30=105cm, ≈14.7 μSv/h (≤25 충족)',
        },
        {
            id: 'rt_hotcell_window_water_54',
            name: 'RT핫셀 창 물30cm만 (54mCi)',
            description: 'RT룸 내 아크릴 수조 핫셀 — 창: 물30cm만 (납유리 없이 시인성 최대), 54mCi',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 100, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 30 },
            ],
            extraShielding: [],
            reportRef: 'RT핫셀 수조창(물만) — 물30cm, 내벽40+창30+외30=100cm, ≈15.9 μSv/h (≤25 충족, 납유리 불요)',
        },
        {
            id: 'rt_hotcell_window_leadglass_54',
            name: 'RT핫셀 창 물30+납유리3cm (54mCi)',
            description: 'RT룸 내 아크릴 수조 핫셀 — 창: 물30cm+납유리(Pb eq.3cm), 54mCi',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 103, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 30 },
                { material: 'Pb', thickness_cm: 3 },    // 납유리 Pb equivalent
            ],
            extraShielding: [],
            reportRef: 'RT핫셀 납유리창 — 물30(n)+납유리3cm(γ), ≈1.30 μSv/h',
        },
        {
            id: 'rt_hotcell_window_leadglass_2700',
            name: 'RT핫셀 창 물30+납유리5cm (2.7Ci)',
            description: 'RT룸 내 아크릴 수조 핫셀 — 창: 물30cm+납유리(Pb eq.5cm), 2.7Ci',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 105, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 30 },
                { material: 'Pb', thickness_cm: 5 },    // 납유리 Pb equivalent
            ],
            extraShielding: [],
            reportRef: 'RT핫셀 납유리창 — 물30(n)+납유리5cm(γ), ≈14.7 μSv/h (≤25 충족)',
        },
        {
            id: 'rt_hotcell_window_lg_thin_2700',
            name: 'RT핫셀 창 물40+납유리3cm (2.7Ci)',
            description: 'RT룸 내 아크릴 수조 핫셀 — 창: 물40cm+납유리(Pb eq.3cm), 2.7Ci — 얇은 납유리 대안',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 113, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 40 },
                { material: 'Pb', thickness_cm: 3 },    // 납유리 Pb equivalent
            ],
            extraShielding: [],
            reportRef: 'RT핫셀 납유리창(대형) — 물40(n)+납유리3cm(γ), ≈24.5 μSv/h (≤25 충족, 마진 적음)',
        },
        {
            id: 'rt_hotcell_ceiling_2700',
            name: 'RT핫셀 천장 물30+납5cm (2.7Ci)',
            description: 'RT룸 내 아크릴 수조 핫셀 — 천장: 물30cm+납5cm, 2.7Ci',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 85, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 30 },
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: 'RT핫셀 천장 — 물30(n)+납5(γ), 선원-천장20+차폐35+외30=85cm, 관리구역 내부 평가',
        },

        // === RT핫셀 설계 탐색 — 콘크리트 핫셀 수조창 대안 (보고서 외) ===
        // 기존 콘크리트 핫셀에 수조창/납유리창을 적용하는 설계 탐색용
        // 거리 150cm = 선원~창 전면 거리 (핫셀 내부 기하 기반)
        {
            id: 'rt_hotcell_window_leadglass_ref',
            name: 'RT핫셀 납유리창만 Pb5cm (2.7Ci, 참고)',
            description: '설계 탐색: 납유리 차폐창(Pb eq. 5cm), 선원-창 150cm — 중성자 비차폐 경고',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 150, container: null },
            ],
            shielding: [
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: '설계 탐색 — Pb eq. 5cm, 중성자 거의 비차폐 (⚠ Cf-252 부적합)',
        },
        {
            id: 'rt_hotcell_window_water_30pb5',
            name: 'RT핫셀 수조창 물30+납5cm (2.7Ci)',
            description: '설계 탐색: 아크릴 수조창 물30cm+납5cm, 선원-창 150cm — 중성자+감마 복합 차폐',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 150, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 30 },
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: '설계 탐색 — 물30cm(n)+납5cm(γ), 복합 차폐 (≈7.2 μSv/h)',
        },
        {
            id: 'rt_hotcell_window_water_50pb5',
            name: 'RT핫셀 수조창 물50+납5cm (2.7Ci, 대형)',
            description: '설계 탐색: 아크릴 대형 수조창 물50cm+납5cm, 선원-창 150cm — 일반인 기준 충족',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 150, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 50 },
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: '설계 탐색 — 물50cm(n)+납5cm(γ), 일반인 기준 충족 (≈1.3 μSv/h)',
        },

        // === 성능시험실(T) RT룸 외벽 차폐 프리셋 ===
        // RT룸 자체 벽을 차폐벽으로 구축하는 경우 (관리구역 외부 평가)
        // 관리구역 내부 기준 (≤ 25 μSv/h) — 최소 차폐 경제적 설계
        // 가정: 실 내부 2m×2m, 선원-벽 내면 100cm, 벽 외 평가점 +30cm
        {
            id: 'rt_room_paraffin_pb_min',
            name: 'RT룸 파라핀8+납5cm (54mCi, 최소, ≤25)',
            description: '성능시험실 RT룸 — 관리구역 내부 기준, 파라핀 8cm + 납 5cm, 벽 외 30cm — 경제적 최소 설계',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 143, container: null },
            ],
            shielding: [
                { material: 'Paraffin', thickness_cm: 8 },
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: 'RT룸 관리구역 내부 설계안 — 파라핀8+납5cm, ≈22.0 μSv/h (≤25 충족)',
        },
        {
            id: 'rt_room_water_pb_min',
            name: 'RT룸 물10+납4cm (54mCi, 최소, ≤25)',
            description: '성능시험실 RT룸 — 관리구역 내부 기준, 물 10cm + 납 4cm, 벽 외 30cm — 경제적 최소 설계',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 144, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 10 },
                { material: 'Pb', thickness_cm: 4 },
            ],
            extraShielding: [],
            reportRef: 'RT룸 관리구역 내부 설계안 — 물10+납4cm, ≈24.5 μSv/h (≤25 충족)',
        },
        {
            id: 'rt_room_pe_pb_min',
            name: 'RT룸 PE8+납5cm (54mCi, 최소, ≤25)',
            description: '성능시험실 RT룸 — 관리구역 내부 기준, PE 8cm + 납 5cm, 벽 외 30cm — 경제적 최소 설계',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 143, container: null },
            ],
            shielding: [
                { material: 'PE', thickness_cm: 8 },
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: 'RT룸 관리구역 내부 설계안 — PE8+납5cm, ≈20.7 μSv/h (≤25 충족)',
        },
        // 관리구역 외부 기준 (≤ 10 μSv/h) — 충분한 차폐 설계
        {
            id: 'rt_room_paraffin_pb',
            name: 'RT룸 파라핀25+납5cm (54mCi, STC-100)',
            description: '성능시험실 RT룸 — 아크릴 구조물+파라핀 25cm(중성자) + 납 5cm(감마), 벽 외 30cm',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 160, container: null },
            ],
            shielding: [
                { material: 'Paraffin', thickness_cm: 25 },
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: 'RT룸 설계안 A — 파라핀(n감속)+납(γ차폐), 선원-평가점 160cm (벽내100+벽30+외30)',
        },
        {
            id: 'rt_room_water_pb',
            name: 'RT룸 물30+납5cm (54mCi, STC-100)',
            description: '성능시험실 RT룸 — 아크릴 수조+물 30cm(중성자) + 납 5cm(감마), 벽 외 30cm',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 165, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 30 },
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: 'RT룸 설계안 B — 물(n감속)+납(γ차폐), 선원-평가점 165cm (벽내100+벽35+외30)',
        },
        {
            id: 'rt_room_bpe_pb',
            name: 'RT룸 보레이트PE20+납3cm (54mCi, 권장)',
            description: '성능시험실 RT룸 — 붕소PE 20cm(n감속+포획) + 납 3cm(감마), 벽 외 30cm — 캡처γ 최소화 최적안',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 153, container: null },
            ],
            shielding: [
                { material: 'PE', thickness_cm: 20 },  // 보레이트PE ≈ PE HVL 사용 (보수적)
                { material: 'Pb', thickness_cm: 3 },
            ],
            extraShielding: [],
            reportRef: 'RT룸 설계안 C(권장) — 보레이트PE(n감속+B-10포획)+납(γ), 캡처γ 0.48MeV로 최소화',
        },
        {
            id: 'rt_room_boricwater_pb',
            name: 'RT룸 붕산수25+납5cm (54mCi)',
            description: '성능시험실 RT룸 — 아크릴 수조+붕산수(5%H₃BO₃) 25cm + 납 5cm, 벽 외 30cm — 실용적 최적안',
            mode: 'storage',
            sources: [
                { activity_mCi: 54, distance_cm: 160, container: null },
            ],
            shielding: [
                { material: 'Water', thickness_cm: 25 },  // 붕산수 ≈ Water HVL (B-10 캡처로 실효 HVL 개선)
                { material: 'Pb', thickness_cm: 5 },
            ],
            extraShielding: [],
            reportRef: 'RT룸 설계안 D — 붕산수(n감속+B-10포획)+납(γ), 아크릴 수조 구축 용이',
        },

        {
            id: 'activation',
            name: '방사화 평가 기본',
            description: '1분 조사, 무차폐, Al-27→Al-28',
            mode: 'activation',
            activity_mCi: 54,
            irradiation_time_min: 1,
            irradiation_distance_cm: 1,
            cooling_time_min: 0,
            eval_distance_cm: 100,
        },
    ],
};

// === 계산 함수 ===

/**
 * 감마선 선량률 (mSv/h)
 * Ḋ_γ = Γ_γ × A / d² × Π(1/2)^(t_i/HVL_i)
 * @param {number} activity_mCi - 방사능량 (mCi)
 * @param {number} distance_cm - 거리 (cm)
 * @param {Array} shielding - [{material: 'Pb'|'Concrete', thickness_cm: N}]
 */
function cf252GammaDoseRate(activity_mCi, distance_cm, shielding = []) {
    let rate = CF252.GAMMA_CONST_MSV * activity_mCi / (distance_cm * distance_cm);
    shielding.forEach(s => {
        const hvl = CF252.HVL_GAMMA[s.material];
        if (hvl && s.thickness_cm > 0) {
            rate *= Math.pow(0.5, s.thickness_cm / hvl);
        }
    });
    return rate; // mSv/h
}

/**
 * 중성자 선량률 (mSv/h)
 * Ḣ_n = Γ_n × A / d² × Π(1/2)^(t_i/HVL_i)
 */
function cf252NeutronDoseRate(activity_mCi, distance_cm, shielding = []) {
    let rate = CF252.NEUTRON_CONST_MSV * activity_mCi / (distance_cm * distance_cm);
    shielding.forEach(s => {
        const hvl = CF252.HVL_NEUTRON[s.material];
        if (hvl && s.thickness_cm > 0) {
            rate *= Math.pow(0.5, s.thickness_cm / hvl);
        }
    });
    return rate; // mSv/h
}

/**
 * 다중 선원 총 선량률 계산
 * @param {Array} sources - [{activity_mCi, distance_cm, container}]
 * @param {Array} extraShielding - [{material, thickness_cm}] 추가 차폐 (벽체 등)
 * @returns {Object} { gamma_mSvh, neutron_mSvh, total_mSvh, gamma_uSvh, neutron_uSvh, total_uSvh, details }
 */
function cf252MultiSourceDoseRate(sources, extraShielding = []) {
    let totalGamma = 0;
    let totalNeutron = 0;
    const details = [];

    sources.forEach((src, idx) => {
        // 용기 차폐 + 추가 차폐 합산
        const allShielding = [];

        // 용기 자체 차폐 (PE 등)
        if (src.container && CF252.CONTAINERS[src.container]) {
            const c = CF252.CONTAINERS[src.container];
            Object.entries(c.shielding).forEach(([mat, thick]) => {
                allShielding.push({ material: mat, thickness_cm: thick });
            });
        }

        // 추가 차폐 (차폐문, 벽체 등)
        extraShielding.forEach(s => allShielding.push(s));

        const gamma = cf252GammaDoseRate(src.activity_mCi, src.distance_cm, allShielding);
        const neutron = cf252NeutronDoseRate(src.activity_mCi, src.distance_cm, allShielding);

        totalGamma += gamma;
        totalNeutron += neutron;

        details.push({
            index: idx + 1,
            activity_mCi: src.activity_mCi,
            distance_cm: src.distance_cm,
            container: src.container,
            gamma_mSvh: gamma,
            neutron_mSvh: neutron,
            total_mSvh: gamma + neutron,
            shielding: allShielding,
        });
    });

    const total = totalGamma + totalNeutron;
    return {
        gamma_mSvh: totalGamma,
        neutron_mSvh: totalNeutron,
        total_mSvh: total,
        gamma_uSvh: totalGamma * 1000,
        neutron_uSvh: totalNeutron * 1000,
        total_uSvh: total * 1000,
        details: details,
    };
}

/**
 * 선량률 기준 적합성 판정
 */
function cf252EvaluateCompliance(total_uSvh) {
    const results = [];
    Object.entries(CF252.LIMITS).forEach(([key, limit]) => {
        results.push({
            key: key,
            label: limit.label,
            limit_uSvh: limit.value,
            actual_uSvh: total_uSvh,
            pass: total_uSvh <= limit.value,
        });
    });
    return results;
}

/**
 * 방사화 평가 (Al-27 → Al-28)
 * A = λ × N × σ × φ × (1 - e^(-λt))
 * 여기서 N은 1로 단순화 (보고서 방식: 선속밀도에 단면적을 곱해 반응률 산출)
 *
 * 보고서 원문 방식:
 * A = (BF_SF × ν × 붕괴율) × σ × (1 - e^(-λt)) / (4π × r²)
 * = N_n × σ × (1 - e^(-λt)) / (4π × r²)
 *
 * @param {number} source_mCi - 선원 방사능량 (mCi)
 * @param {number} irrad_time_s - 조사시간 (초)
 * @param {number} irrad_dist_cm - 조사거리 (cm)
 * @param {number} cooling_time_s - 냉각시간 (초)
 * @param {number} eval_dist_cm - 선량률 평가거리 (cm)
 * @returns {Object}
 */
function cf252ActivationCalc(source_mCi, irrad_time_s, irrad_dist_cm, cooling_time_s = 0, eval_dist_cm = 100) {
    const lambda = CF252.AL28_DECAY_CONST;

    // 중성자 선속밀도 at irradiation distance
    const phi = CF252.NEUTRON_RATE_PER_MCI * source_mCi / (4 * Math.PI * irrad_dist_cm * irrad_dist_cm);

    // 포화 방사화량 (단위: dis/s = Bq, N_target × σ 포함)
    // 보고서 방식: 반응률 R = φ × σ (per target atom per second)
    // 포화 방사화: A_sat = R (1개 원자 기준 → 실제 원자수는 매니퓰레이터 크기에 의존)
    // 보고서에서는 "단위 면적당" 또는 특정 조사 체적 기준으로 환산
    // 여기서는 보고서의 최종 공식을 따름:
    // A(Bq) = φ × σ × (1 - e^(-λt)) / λ × N_atom
    // 단, N_atom은 사용자가 입력하지 않으므로 보고서 기본값 사용

    // 보고서 원문 간소화 공식 (매니퓰레이터 1개 기준):
    // 반응률 = φ × σ_a
    const reactionRate = phi * CF252.AL27_CROSS_SECTION;

    // 방사화량 (Bq) = λ × N_target × σ × φ × (1-e^(-λt)) / λ
    // = N_target × σ × φ × (1-e^(-λt))
    // 보고서에서 N_target은 집게 부분의 Al-27 원자수
    // 기본 가정: 10cm³ Al 체적, 밀도 2.7g/cm³, M=26.98g/mol
    const Al_volume_cm3 = 10;
    const Al_density = 2.7;   // g/cm³
    const Al_mass_g = Al_volume_cm3 * Al_density;
    const N_A = 6.022e23;
    const Al_M = 26.98;
    const N_target = (Al_mass_g / Al_M) * N_A;

    // A(Bq) = N_target × σ × φ × (1 - e^(-λ×t))
    const saturation_factor = 1 - Math.exp(-lambda * irrad_time_s);
    const activity_Bq = N_target * CF252.AL27_CROSS_SECTION * phi * saturation_factor;

    // 냉각 후 방사화량
    const cooled_Bq = activity_Bq * Math.exp(-lambda * cooling_time_s);

    // Bq → mCi 변환 (1 mCi = 3.7e7 Bq)
    const cooled_mCi = cooled_Bq / 3.7e7;

    // Al-28 감마선 선량률 at eval_distance
    const doseRate_mSvh = CF252.AL28_GAMMA_CONST_MSV * cooled_mCi / (eval_dist_cm * eval_dist_cm);

    return {
        phi_neutrons_cm2s: phi,
        reactionRate_per_s: reactionRate,
        N_target: N_target,
        activity_Bq: activity_Bq,
        cooled_activity_Bq: cooled_Bq,
        cooled_activity_mCi: cooled_mCi,
        doseRate_mSvh: doseRate_mSvh,
        doseRate_uSvh: doseRate_mSvh * 1000,
        irrad_time_s: irrad_time_s,
        cooling_time_s: cooling_time_s,
        eval_dist_cm: eval_dist_cm,
        source_mCi: source_mCi,
        irrad_dist_cm: irrad_dist_cm,
    };
}

/**
 * 차폐 역산: 목표 선량률 이하로 낮추기 위한 차폐 두께 계산
 * 감마+중성자가 서로 다른 HVL을 가지므로 해석해 없음 → bisection으로 수치해
 * @param {number} activity_mCi - 방사능량 (mCi)
 * @param {number} distance_cm - 거리 (cm)
 * @param {string} material - 차폐재 ('Pb'|'Concrete'|'PE')
 * @param {number} target_uSvh - 목표 선량률 (μSv/h)
 * @param {Array} existingShielding - 기존 차폐 [{material, thickness_cm}]
 * @returns {Object|null}
 */
function cf252ShieldInverseCalc(activity_mCi, distance_cm, material, target_uSvh, existingShielding = []) {
    const target_mSvh = target_uSvh / 1000;

    // 기존 차폐 적용 후 무차폐 선량률 (추가 차폐 전 기준)
    const baseGamma = cf252GammaDoseRate(activity_mCi, distance_cm, existingShielding);
    const baseNeutron = cf252NeutronDoseRate(activity_mCi, distance_cm, existingShielding);
    const baseTotal = baseGamma + baseNeutron;

    // 이미 목표 이하면 차폐 불필요
    if (baseTotal * 1000 <= target_uSvh) {
        return { thickness_cm: 0, gamma_before: baseGamma, neutron_before: baseNeutron, total_before_uSvh: baseTotal * 1000, gamma_after: baseGamma, neutron_after: baseNeutron, total_after_uSvh: baseTotal * 1000, material: material };
    }

    const hvlG = CF252.HVL_GAMMA[material] || 0;
    const hvlN = CF252.HVL_NEUTRON[material] || 0;

    // 최소 하나의 HVL이 있어야 함
    if (hvlG === 0 && hvlN === 0) return null;

    // f(t) = gamma*2^(-t/hvlG) + neutron*2^(-t/hvlN) - target
    const f = (t) => {
        let g = hvlG > 0 ? baseGamma * Math.pow(0.5, t / hvlG) : baseGamma;
        let n = hvlN > 0 ? baseNeutron * Math.pow(0.5, t / hvlN) : baseNeutron;
        return g + n - target_mSvh;
    };

    // Bisection: find t where f(t) = 0
    let lo = 0, hi = 1;
    // 상한 확장
    while (f(hi) > 0 && hi < 10000) hi *= 2;
    if (f(hi) > 0) return null; // 수렴 불가

    for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) > 0) lo = mid;
        else hi = mid;
        if (hi - lo < 0.001) break; // 0.001 cm 정밀도
    }

    const thickness = (lo + hi) / 2;
    const gAfter = hvlG > 0 ? baseGamma * Math.pow(0.5, thickness / hvlG) : baseGamma;
    const nAfter = hvlN > 0 ? baseNeutron * Math.pow(0.5, thickness / hvlN) : baseNeutron;

    return {
        thickness_cm: thickness,
        material: material,
        gamma_before: baseGamma,
        neutron_before: baseNeutron,
        total_before_uSvh: baseTotal * 1000,
        gamma_after: gAfter,
        neutron_after: nAfter,
        total_after_uSvh: (gAfter + nAfter) * 1000,
    };
}

/**
 * Cf-252 방사능 감쇠 계산
 */
function cf252DecayActivity(initial_mCi, elapsed_days) {
    const hl_days = CF252.HALF_LIFE_Y * 365.25;
    return initial_mCi * Math.pow(0.5, elapsed_days / hl_days);
}
