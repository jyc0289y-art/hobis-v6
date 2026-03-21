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
    F_FACTOR: 0.960,               // cGy/R
    // 실무 단위: 2.31 × 0.960 × 10 = 22.176 mSv·cm²/(mCi·h)
    get GAMMA_CONST_MSV() {
        return this.GAMMA_CONST_TRAD * this.F_FACTOR * 10;
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

    // === HVL 값 (cm) — 6차 보완 최종 채택 ===
    HVL_GAMMA: {
        'Pb': 0.82,
        'Concrete': 5.03,
    },
    HVL_NEUTRON: {
        'PE': 1.85,
        'Pb': 3.45,
        'Concrete': 3.03,
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
    // ENDF/B 기반, 약 0.5~1 mb → 보수적으로 1 mb = 1e-27 cm² 사용
    AL27_CROSS_SECTION: 1.0e-27,    // cm² (1 mb)

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
    // 핫셀: 2,650×1,800×4,550mm/셀, 외벽 1,200mm(일반)/1,350mm(C1-DP2)/천장 600mm
    // S-DP = 선량평가점 (Safety-Dose evaluation Point)
    PRESETS: [
        {
            id: 'stc100_x4_surface',
            name: '퍼 STC-100×4 표면 (S-DP01)',
            description: '51mCi×4, 용기 표면 — 보고서 p.55: 7.00×10⁻⁶ mSv/h',
            mode: 'storage',
            sources: [
                { activity_mCi: 51, distance_cm: 30, container: 'STC-100' },
                { activity_mCi: 51, distance_cm: 50, container: 'STC-100' },
                { activity_mCi: 51, distance_cm: 70, container: 'STC-100' },
                { activity_mCi: 51, distance_cm: 90, container: 'STC-100' },
            ],
            shielding: [],
            extraShielding: [],
            reportRef: 'S-DP01, p.55: 7.00×10⁻⁶ mSv/h',
        },
        {
            id: 'stc100_x4_wall',
            name: '퍼 STC-100×4 벽외부 (S-DP02~05)',
            description: '51mCi×4, 콘크리트 벽 120cm 외부 — 보고서 p.55: 2.92×10⁻³ mSv/h',
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
            reportRef: 'S-DP02~05, p.55: 2.92×10⁻³ mSv/h',
        },
        {
            id: 'uktib_x2_surface',
            name: '허 УКТIIB×2 표면 (S-DP01)',
            description: '97mCi×2, 용기 표면 — 보고서 p.55: 5.08×10⁻⁵ mSv/h',
            mode: 'storage',
            sources: [
                { activity_mCi: 97, distance_cm: 36, container: 'UKTIB-313' },
                { activity_mCi: 97, distance_cm: 56, container: 'UKTIB-313' },
            ],
            shielding: [],
            extraShielding: [],
            reportRef: 'S-DP01, p.55: 5.08×10⁻⁵ mSv/h',
        },
        {
            id: 'uktib_x2_wall',
            name: '허 УКТIIB×2 벽외부 (S-DP02~05)',
            description: '97mCi×2, 콘크리트 벽 120cm 외부 — 보고서 p.55: 2.36×10⁻³ mSv/h',
            mode: 'storage',
            sources: [
                { activity_mCi: 97, distance_cm: 300, container: 'UKTIB-313' },
                { activity_mCi: 97, distance_cm: 320, container: 'UKTIB-313' },
            ],
            shielding: [],
            extraShielding: [
                { material: 'Concrete', thickness_cm: 120 },
            ],
            reportRef: 'S-DP02~05, p.55: 2.36×10⁻³ mSv/h',
        },
        {
            id: 'hotcell_storage',
            name: '핫셀 저장 2.7Ci (벽외부)',
            description: '셀당 2.7Ci, 외벽 120cm — 보고서 p.70,73',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 224, container: null },
            ],
            shielding: [
                { material: 'Concrete', thickness_cm: 120 },
            ],
            extraShielding: [],
            reportRef: '핫셀 기준거리 √((1.325²+1.8²))=2.24m, 외벽 1,200mm',
        },
        {
            id: 'hotcell_storage_dp2',
            name: '핫셀 저장 2.7Ci (C1-DP2 방향)',
            description: '셀당 2.7Ci, C1-DP2 방향 외벽 135cm — 보고서 p.73',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 224, container: null },
            ],
            shielding: [
                { material: 'Concrete', thickness_cm: 135 },
            ],
            extraShielding: [],
            reportRef: '핫셀 C1-DP2 방향 외벽 1,350mm',
        },
        {
            id: 'hotcell_ceiling',
            name: '핫셀 저장 2.7Ci (천장)',
            description: '셀당 2.7Ci, 천장 60cm — 보고서 p.73',
            mode: 'storage',
            sources: [
                { activity_mCi: 2700, distance_cm: 224, container: null },
            ],
            shielding: [
                { material: 'Concrete', thickness_cm: 60 },
            ],
            extraShielding: [],
            reportRef: '핫셀 천장 600mm',
        },
        {
            id: 'activation',
            name: '방사화 평가 기본',
            description: '1분 조사, 무차폐, Al-27→Al-28',
            mode: 'activation',
            activity_mCi: 54,
            irradiation_time_min: 1,
            irradiation_distance_cm: 5,
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
 * Cf-252 방사능 감쇠 계산
 */
function cf252DecayActivity(initial_mCi, elapsed_days) {
    const hl_days = CF252.HALF_LIFE_Y * 365.25;
    return initial_mCi * Math.pow(0.5, elapsed_days / hl_days);
}
