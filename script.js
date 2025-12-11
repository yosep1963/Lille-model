/**
 * Lille Score Calculator
 * 중증 알코올성 간염 환자의 스테로이드 치료 반응 평가
 */

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
        resultSection.classList.add('hidden');
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

/**
 * Lille Score 계산 메인 함수
 */
function calculateLilleScore() {
    // 입력값 수집
    const age = parseFloat(document.getElementById('age').value);
    let albumin = parseFloat(document.getElementById('albumin').value);
    let bilirubinDay0 = parseFloat(document.getElementById('bilirubinDay0').value);
    let bilirubinDay7 = parseFloat(document.getElementById('bilirubinDay7').value);
    let creatinine = parseFloat(document.getElementById('creatinine').value);
    const pt = parseFloat(document.getElementById('pt').value);

    // 단위 선택값 가져오기
    const albuminUnit = document.getElementById('albuminUnit').value;
    const bilirubinDay0Unit = document.getElementById('bilirubinDay0Unit').value;
    const bilirubinDay7Unit = document.getElementById('bilirubinDay7Unit').value;
    const creatinineUnit = document.getElementById('creatinineUnit').value;

    // 입력값 유효성 검사 (변환 전)
    if (!validateInputs(age, albumin, bilirubinDay0, bilirubinDay7, creatinine, pt)) {
        alert('모든 항목을 올바르게 입력해주세요.');
        return;
    }

    // 단위 변환: 모든 값을 mg/dL, g/dL 단위로 변환
    // 알부민: g/L → g/dL (÷10)
    if (albuminUnit === 'g/L') {
        albumin = albumin / 10;
    }

    // 빌리루빈: μmol/L → mg/dL (÷17.1)
    if (bilirubinDay0Unit === 'μmol/L') {
        bilirubinDay0 = bilirubinDay0 / 17.1;
    }
    if (bilirubinDay7Unit === 'μmol/L') {
        bilirubinDay7 = bilirubinDay7 / 17.1;
    }

    // 크레아티닌: μmol/L → mg/dL (÷88.4)
    if (creatinineUnit === 'μmol/L') {
        creatinine = creatinine / 88.4;
    }

    // 빌리루빈 변화량 (Day 0 - Day 7) in mg/dL
    const deltaBilirubin = bilirubinDay0 - bilirubinDay7;

    // 신부전 여부 (크레아티닌 > 1.3 mg/dL)
    const renalInsufficiency = creatinine > 1.3 ? 1 : 0;

    // Lille Score 계산 (mg/dL 단위 공식 사용)
    const lilleScore = computeLilleScore(age, albumin, deltaBilirubin, renalInsufficiency, bilirubinDay0, pt);

    // 결과 표시
    displayResults(lilleScore);
}

/**
 * 입력값 유효성 검사
 * 단위 변환 전이므로 넓은 범위로 검사
 */
function validateInputs(age, albumin, bilirubinDay0, bilirubinDay7, creatinine, pt) {
    if (isNaN(age) || age < 18 || age > 120) return false;
    if (isNaN(albumin) || albumin <= 0 || albumin > 100) return false;  // g/L까지 허용
    if (isNaN(bilirubinDay0) || bilirubinDay0 <= 0) return false;
    if (isNaN(bilirubinDay7) || bilirubinDay7 <= 0) return false;
    if (isNaN(creatinine) || creatinine <= 0) return false;
    if (isNaN(pt) || pt < 5 || pt > 100) return false;
    return true;
}

/**
 * 알부민 단위 변환: g/dL → g/L
 */
function convertAlbuminToGL(albuminGdL) {
    return albuminGdL * 10;
}

/**
 * 빌리루빈 단위 변환: mg/dL → μmol/L
 */
function convertBilirubinToUmol(bilirubinMgdL) {
    return bilirubinMgdL * 17.1;
}

/**
 * Lille Score 계산 (SI 단위 공식 사용)
 *
 * 원본 공식 (Louvet et al., Hepatology 2007):
 * R = 3.19 - 0.101×age + 0.147×albumin(g/L) + 0.0165×ΔBilirubin(μmol/L)
 *     - 0.206×renalInsufficiency(0/1) - 0.0065×bilirubin_day0(μmol/L) - 0.0096×PT(sec)
 *
 * Lille Score = exp(-R) / (1 + exp(-R))
 *
 * 입력: 모든 값은 이미 mg/dL, g/dL로 변환된 상태
 * 내부적으로 SI 단위로 변환하여 계산
 */
function computeLilleScore(age, albuminGdL, deltaBilirubinMgdL, renalInsufficiency, biliDay0MgdL, pt) {
    // mg/dL, g/dL → SI 단위 변환
    const albuminGL = albuminGdL * 10;  // g/dL → g/L
    const deltaBilirubinUmol = deltaBilirubinMgdL * 17.1;  // mg/dL → μmol/L
    const biliDay0Umol = biliDay0MgdL * 17.1;  // mg/dL → μmol/L

    // SI 단위 공식 적용
    const R = 3.19
        - (0.101 * age)
        + (0.147 * albuminGL)
        + (0.0165 * deltaBilirubinUmol)
        - (0.206 * renalInsufficiency)
        - (0.0065 * biliDay0Umol)
        - (0.0096 * pt);

    const expNegR = Math.exp(-R);
    const lilleScore = expNegR / (1 + expNegR);

    return lilleScore;
}

/**
 * 결과 표시
 */
function displayResults(score) {
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
    clinicalDescription.innerHTML = getClinicalDescription(score, binaryResult, ternaryResult);

    // 결과 섹션 표시
    resultSection.classList.remove('hidden');

    // 결과 섹션으로 스크롤
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 0.45 기준 이분법 해석
 */
function interpretBinary(score) {
    if (score < 0.45) {
        return {
            label: 'Responder',
            class: 'responder',
            description: '6개월 생존율 약 85%. 스테로이드 치료에 반응하는 환자입니다. 28일간 스테로이드 치료를 완료하는 것이 권고됩니다.',
            survival: '~85%'
        };
    } else {
        return {
            label: 'Non-responder',
            class: 'non-responder',
            description: '6개월 생존율 약 25%. 스테로이드 치료에 반응하지 않는 환자입니다. 스테로이드 중단을 고려하고 다른 치료 옵션(간이식 평가 등)을 검토해야 합니다.',
            survival: '~25%'
        };
    }
}

/**
 * 0.16/0.56 기준 삼분법 해석
 */
function interpretTernary(score) {
    if (score < 0.16) {
        return {
            label: 'Complete Responder',
            class: 'complete',
            description: '치료 반응이 우수합니다. 스테로이드 치료에 매우 잘 반응하고 있으며, 예후가 양호합니다.'
        };
    } else if (score < 0.56) {
        return {
            label: 'Partial Responder',
            class: 'partial',
            description: '부분적 치료 반응을 보입니다. 스테로이드 치료를 지속하면서 주의 깊은 관찰이 필요합니다.'
        };
    } else {
        return {
            label: 'Null Responder',
            class: 'null',
            description: '치료 반응이 없습니다. 스테로이드 치료의 효과가 없으므로 중단을 강력히 고려해야 합니다.'
        };
    }
}

/**
 * 임상적 의의 설명 생성
 */
function getClinicalDescription(score, binaryResult, ternaryResult) {
    let description = '';

    description += `<strong>Lille Score ${score.toFixed(3)}</strong>은(는) `;

    if (score < 0.16) {
        description += '스테로이드 치료에 <strong>매우 우수한 반응</strong>을 나타냅니다. ';
        description += '예정된 28일 스테로이드 치료를 완료하시기 바랍니다. ';
        description += '6개월 생존율은 약 85% 이상으로 예상됩니다.';
    } else if (score < 0.45) {
        description += '스테로이드 치료에 <strong>양호한 반응</strong>을 보입니다. ';
        description += '치료를 지속하되, 환자 상태를 주의 깊게 모니터링하세요. ';
        description += '6개월 생존율은 약 85%로 예상됩니다.';
    } else if (score < 0.56) {
        description += '스테로이드 치료에 <strong>경계성 반응</strong>을 보입니다. ';
        description += '치료 지속 여부에 대해 신중한 판단이 필요합니다. ';
        description += '개별 환자 상황을 고려한 임상적 결정이 중요합니다.';
    } else {
        description += '스테로이드 치료에 <strong>반응하지 않음</strong>을 나타냅니다. ';
        description += '스테로이드 중단을 강력히 고려하고, 간이식 적합성 평가나 완화 치료 등 ';
        description += '다른 치료 옵션을 검토해야 합니다. 6개월 생존율은 약 25%로 낮습니다.';
    }

    return description;
}
