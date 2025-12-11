# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lille Score 계산기 - 중증 알코올성 간염 환자의 코르티코스테로이드 치료 반응을 평가하는 의료용 PWA 웹앱 (한국어 인터페이스)

## Development Commands

```bash
# 로컬 서버 실행
npx serve -l 3000

# Netlify CLI 배포
netlify deploy --prod
```

## Architecture

**Pure Vanilla Stack** - 빌드 도구 없이 HTML/CSS/JS만 사용

- `index.html` - 메인 페이지, 입력 폼 6개 필드 (나이, 알부민, 빌리루빈 Day0/Day7, 크레아티닌, PT)
- `script.js` - Lille Score 계산 로직 (SI 단위 공식 사용)
- `styles.css` - 반응형 디자인, 다크모드 지원
- `sw.js` - Service Worker (Cache First 전략, 오프라인 지원)
- `manifest.json` - PWA 매니페스트

## Lille Score Formula (Louvet et al., Hepatology 2007)

```
R = 3.19 - 0.101×age + 0.147×albumin(g/L) + 0.0165×ΔBilirubin(μmol/L)
    - 0.206×renalInsufficiency(0/1) - 0.0065×bilirubin_day0(μmol/L) - 0.0096×PT(sec)

Lille Score = exp(-R) / (1 + exp(-R))
```

- 사용자 입력은 mg/dL, g/dL 단위 → 내부적으로 SI 단위(μmol/L, g/L)로 변환하여 계산
- Renal insufficiency: 크레아티닌 > 1.3 mg/dL (또는 > 115 μmol/L)이면 1, 아니면 0

## Unit Conversion Support

알부민, 빌리루빈, 크레아티닌 필드에 단위 선택 드롭다운 제공:
- 알부민: g/dL ↔ g/L (×10)
- 빌리루빈: mg/dL ↔ μmol/L (×17.1)
- 크레아티닌: mg/dL ↔ μmol/L (×88.4)

## Result Interpretation

- **0.45 기준 (이분법)**: Responder (< 0.45, 6개월 생존율 ~85%) / Non-responder (≥ 0.45, ~25%)
- **0.16/0.56 기준 (삼분법)**: Complete / Partial / Null responder

## Cache Versioning

`sw.js`의 `CACHE_NAME` 버전을 변경하면 새 캐시가 생성되고 이전 캐시는 삭제됨
