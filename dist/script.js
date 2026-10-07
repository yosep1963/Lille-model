/**
 * Lille Score Calculator
 * 중증 알코올성 간염 환자의 스테로이드 치료 반응 평가
 */

// 단위 변환 계수 (→ SI 단위)
const ALBUMIN_GDL_TO_GL = 10;          // g/dL → g/L
const BILIRUBIN_MGDL_TO_UMOL = 17.1;   // mg/dL → μmol/L
const CREATININE_MGDL_TO_UMOL = 88.4;  // mg/dL → μmol/L

// 신부전 기준 (Louvet 2007): 크레아티닌 > 1.3 mg/dL 또는 > 115 μmol/L
const RENAL_THRESHOLD = { 'mg/dL': 1.3, 'μmol/L': 115 };

// 해석 기준
// 이분법 (Louvet 2007): Responder < 0.45, Non-responder ≥ 0.45
// 삼분법 (Mathurin 2011): Complete ≤ 0.16, Partial 0.16 초과 ~ 0.56 미만, Null ≥ 0.56
const BINARY_CUTOFF = 0.45;
const TERNARY_COMPLETE_MAX = 0.16;
const TERNARY_NULL_MIN = 0.56;

// 생리적 허용 범위 (SI 단위 기준) - 단위 선택 오류를 걸러내기 위함
const VALID_RANGES = {
    age: { min: 18, max: 120, unit: '세' },
    albumin: { min: 10, max: 60, unit: 'g/L', alt: '1.0–6.0 g/dL' },
    bilirubinDay0: { min: 1, max: 1500, unit: 'μmol/L', alt: '0.06–87.7 mg/dL' },
    bilirubinDay7: { min: 1, max: 1500, unit: 'μmol/L', alt: '0.06–87.7 mg/dL' },
    creatinine: { min: 20, max: 1500, unit: 'μmol/L', alt: '0.23–17.0 mg/dL' },
    pt: { min: 5, max: 100, unit: '초' }
};

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        const form = document.getElementById('lilleForm');
        const resetBtn = document.getElementById('resetBtn');
        const resultSection = document.getElementById('resultSection');

        // 폼 제출 이벤트
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            calculateLilleScore();
        });

        // 초기화 버튼 이벤트
        resetBtn.addEventListener('click', function() {
            form.reset();
            clearFieldErrors();
            resultSection.classList.add('hidden');
        });

        // 값이나 단위를 바꾸면 해당 필드의 오류 표시 제거
        Object.keys(VALID_RANGES).forEach(function(id) {
            const input = document.getElementById(id);
            const unitSelect = document.getElementById(id + 'Unit');
            input.addEventListener('input', function() { setFieldError(id, null); });
            if (unitSelect) {
                unitSelect.addEventListener('change', function() { setFieldError(id, null); });
            }
        });

        // Service Worker 등록
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(function(registration) {
                    console.log('Service Worker 등록 성공:', registration.scope);
                })
                .catch(function(error) {
                    console.log('Service Worker 등록 실패:', error);
                });
        }
    });
}

/**
 * Lille Score 계산 메인 함수
 */
function calculateLilleScore() {
    // 입력값 수집
    const raw = {
        age: parseFloat(document.getElementById('age').value),
        albumin: parseFloat(document.getElementById('albumin').value),
        bilirubinDay0: parseFloat(document.getElementById('bilirubinDay0').value),
        bilirubinDay7: parseFloat(document.getElementById('bilirubinDay7').value),
        creatinine: parseFloat(document.getElementById('creatinine').value),
        pt: parseFloat(document.getElementById('pt').value)
    };

    // 단위 선택값 가져오기
    const units = {
        albumin: document.getElementById('albuminUnit').value,
        bilirubinDay0: document.getElementById('bilirubinDay0Unit').value,
        bilirubinDay7: document.getElementById('bilirubinDay7Unit').value,
        creatinine: document.getElementById('creatinineUnit').value
    };

    // 입력 즉시 SI 단위로 한 번만 정규화
    const si = normalizeToSI(raw, units);

    // SI 단위 기준 유효성 검사
    clearFieldErrors();
    const errors = validateInputs(si, units);
    const errorIds = Object.keys(errors);
    if (errorIds.length > 0) {
        errorIds.forEach(function(id) { setFieldError(id, errors[id]); });
        document.getElementById(errorIds[0]).focus();
        document.getElementById('resultSection').classList.add('hidden');
        return;
    }

    // 신부전 여부: 사용자가 입력한 원래 단위의 기준으로 판정 (변환에 따른 경계 오차 방지)
    const renalInsufficiency = isRenalInsufficiency(raw.creatinine, units.creatinine);

    // Lille Score 계산 (SI 단위 공식)
    const lilleScore = computeLilleScore(
        si.age, si.albumin, si.bilirubinDay0, si.bilirubinDay7, renalInsufficiency, si.pt
    );

    // 결과 표시
    displayResults(lilleScore);
}

/**
 * 입력값을 SI 단위(알부민 g/L, 빌리루빈·크레아티닌 μmol/L)로 변환
 */
function normalizeToSI(raw, units) {
    return {
        age: raw.age,
        albumin: units.albumin === 'g/dL' ? raw.albumin * ALBUMIN_GDL_TO_GL : raw.albumin,
        bilirubinDay0: units.bilirubinDay0 === 'mg/dL' ? raw.bilirubinDay0 * BILIRUBIN_MGDL_TO_UMOL : raw.bilirubinDay0,
        bilirubinDay7: units.bilirubinDay7 === 'mg/dL' ? raw.bilirubinDay7 * BILIRUBIN_MGDL_TO_UMOL : raw.bilirubinDay7,
        creatinine: units.creatinine === 'mg/dL' ? raw.creatinine * CREATININE_MGDL_TO_UMOL : raw.creatinine,
        pt: raw.pt
    };
}

/**
 * 입력값 유효성 검사 (SI 단위 기준)
 * 반환: { 필드id: 오류 메시지 } - 오류가 없으면 빈 객체
 */
function validateInputs(si, units) {
    const errors = {};

    Object.keys(VALID_RANGES).forEach(function(id) {
        const value = si[id];
        const range = VALID_RANGES[id];

        if (isNaN(value)) {
            errors[id] = '값을 입력해주세요.';
        } else if (value < range.min || value > range.max) {
            let message = '허용 범위(' + range.min + '–' + range.max + ' ' + range.unit;
            if (range.alt) message += ' = ' + range.alt;
            message += ')를 벗어났습니다.';
            if (units[id]) message += ' 선택한 단위(' + units[id] + ')가 맞는지 확인하세요.';
            errors[id] = message;
        }
    });

    return errors;
}

/**
 * 신부전 판정: 크레아티닌 > 1.3 mg/dL 또는 > 115 μmol/L
 */
function isRenalInsufficiency(creatinine, unit) {
    return creatinine > RENAL_THRESHOLD[unit] ? 1 : 0;
}

/**
 * 필드별 오류 메시지 표시 (message가 null이면 제거)
 */
function setFieldError(id, message) {
    const group = document.getElementById(id).closest('.input-group');
    let errorEl = group.querySelector('.field-error');

    if (!message) {
        group.classList.remove('invalid');
        if (errorEl) errorEl.remove();
        return;
    }

    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.className = 'field-error';
        errorEl.setAttribute('role', 'alert');
        group.appendChild(errorEl);
    }
    group.classList.add('invalid');
    errorEl.textContent = message;
}

function clearFieldErrors() {
    Object.keys(VALID_RANGES).forEach(function(id) { setFieldError(id, null); });
}

/**
 * Lille Score 계산 (SI 단위 공식 사용)
 *
 * 원본 공식 (Louvet et al., Hepatology 2007):
 * R = 3.19 - 0.101×age + 0.147×albumin(g/L) + 0.0165×ΔBilirubin(μmol/L)
 *     - 0.206×renalInsufficiency(0/1) - 0.0065×bilirubin_day0(μmol/L) - 0.0096×PT(sec)
 * ΔBilirubin = bilirubin_day0 - bilirubin_day7
 *
 * Lille Score = exp(-R) / (1 + exp(-R))
 *
 * 입력: 알부민 g/L, 빌리루빈 μmol/L, PT 초
 */
function computeLilleScore(age, albuminGL, biliDay0Umol, biliDay7Umol, renalInsufficiency, pt) {
    const deltaBilirubinUmol = biliDay0Umol - biliDay7Umol;

    const R = 3.19
        - (0.101 * age)
        + (0.147 * albuminGL)
        + (0.0165 * deltaBilirubinUmol)
        - (0.206 * renalInsufficiency)
        - (0.0065 * biliDay0Umol)
        - (0.0096 * pt);

    const expNegR = Math.exp(-R);
    return expNegR / (1 + expNegR);
}

/**
 * 표시값(소수점 3자리)으로 반올림
 * 화면에 보이는 점수와 판정이 경계에서 어긋나지 않도록 판정에도 이 값을 사용
 * (예: 0.4496은 0.450으로 표시되므로 Non-responder로 판정)
 */
function roundScore(score) {
    return Math.round(score * 1000) / 1000;
}

/**
 * 결과 표시
 */
function displayResults(rawScore) {
    const score = roundScore(rawScore);
    const resultSection = document.getElementById('resultSection');
    const scoreDisplay = document.getElementById('lilleScore');
    const binaryBadge = document.getElementById('binaryBadge');
    const binaryDescription = document.getElementById('binaryDescription');
    const ternaryBadge = document.getElementById('ternaryBadge');
    const ternaryDescription = document.getElementById('ternaryDescription');
    const clinicalDescription = document.getElementById('clinicalDescription');

    // Lille Score 표시 (소수점 3자리)
    scoreDisplay.textContent = score.toFixed(3);

    // 0.45 기준 이분법 결과
    const binaryResult = interpretBinary(score);
    binaryBadge.textContent = binaryResult.label;
    binaryBadge.className = 'result-badge ' + binaryResult.class;
    binaryDescription.textContent = binaryResult.description;

    // 0.16/0.56 기준 삼분법 결과
    const ternaryResult = interpretTernary(score);
    ternaryBadge.textContent = ternaryResult.label;
    ternaryBadge.className = 'result-badge ' + ternaryResult.class;
    ternaryDescription.textContent = ternaryResult.description;

    // 임상적 의의
    clinicalDescription.innerHTML = getClinicalDescription(score);

    // 결과 섹션 표시
    resultSection.classList.remove('hidden');

    // 결과 섹션으로 스크롤
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 0.45 기준 이분법 해석 (Louvet 2007)
 * Responder < 0.45 / Non-responder ≥ 0.45
 */
function interpretBinary(score) {
    if (score < BINARY_CUTOFF) {
        return {
            label: 'Responder (< 0.45)',
            class: 'responder',
            description: '6개월 생존율 약 85%. 스테로이드 치료에 반응하는 환자입니다. 28일간 스테로이드 치료를 완료하는 것이 권고됩니다.'
        };
    }
    return {
        label: 'Non-responder (≥ 0.45)',
        class: 'non-responder',
        description: '6개월 생존율 약 25%. 스테로이드 치료에 반응하지 않는 환자입니다. 스테로이드 중단을 고려하고 다른 치료 옵션(간이식 평가 등)을 검토해야 합니다.'
    };
}

/**
 * 0.16/0.56 기준 삼분법 해석 (Mathurin 2011)
 * Complete ≤ 0.16 / Partial 0.16 초과 ~ 0.56 미만 / Null ≥ 0.56
 */
function interpretTernary(score) {
    if (score <= TERNARY_COMPLETE_MAX) {
        return {
            label: 'Complete Responder (≤ 0.16)',
            class: 'complete',
            description: '28일 생존율 약 91%. 스테로이드 치료에 매우 잘 반응하고 있으며, 예후가 양호합니다.'
        };
    }
    if (score < TERNARY_NULL_MIN) {
        return {
            label: 'Partial Responder (0.16–0.56)',
            class: 'partial',
            description: '28일 생존율 약 79%. 부분적 치료 반응을 보이며, 스테로이드 치료가 생존에 도움이 되는 군입니다. 주의 깊은 관찰이 필요합니다.'
        };
    }
    return {
        label: 'Null Responder (≥ 0.56)',
        class: 'null',
        description: '28일 생존율 약 53%. 스테로이드 치료의 생존 이득이 없으므로 중단을 강력히 고려해야 합니다.'
    };
}

/**
 * 임상적 의의 설명 생성
 * 구간: ≤ 0.16 / 0.16 초과 ~ 0.45 미만 / 0.45 이상 ~ 0.56 미만 / ≥ 0.56
 */
function getClinicalDescription(score) {
    let description = `<strong>Lille Score ${score.toFixed(3)}</strong>은(는) `;

    if (score <= TERNARY_COMPLETE_MAX) {
        description += '스테로이드 치료에 <strong>매우 우수한 반응</strong>(Complete responder)을 나타냅니다. ';
        description += '예정된 28일 스테로이드 치료를 완료하시기 바랍니다. ';
        description += '28일 생존율 약 91%, 6개월 생존율 약 85%(0.45 미만 군)로 예상됩니다.';
    } else if (score < BINARY_CUTOFF) {
        description += '스테로이드 치료에 <strong>양호한 반응</strong>(Responder, Partial responder)을 보입니다. ';
        description += '치료를 지속하되, 환자 상태를 주의 깊게 모니터링하세요. ';
        description += '6개월 생존율 약 85%(0.45 미만 군), 28일 생존율 약 79%(Partial 군)로 예상됩니다.';
    } else if (score < TERNARY_NULL_MIN) {
        description += '스테로이드 치료에 <strong>경계성 반응</strong>(Non-responder, Partial responder)을 보입니다. ';
        description += '이분법상 무반응군(6개월 생존율 약 25%)이지만 삼분법상 부분 반응군(28일 생존율 약 79%)에 해당하므로, ';
        description += '치료 지속 여부는 개별 환자 상황을 고려하여 신중히 결정해야 합니다.';
    } else {
        description += '스테로이드 치료에 <strong>반응하지 않음</strong>(Null responder)을 나타냅니다. ';
        description += '스테로이드 중단을 강력히 고려하고, 간이식 적합성 평가나 완화 치료 등 ';
        description += '다른 치료 옵션을 검토해야 합니다. 28일 생존율 약 53%, 6개월 생존율 약 25%로 낮습니다.';
    }

    return description;
}

// Node 환경 테스트용 export (브라우저에서는 무시됨)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeToSI, validateInputs, isRenalInsufficiency, computeLilleScore,
        roundScore, interpretBinary, interpretTernary, getClinicalDescription
    };
}
