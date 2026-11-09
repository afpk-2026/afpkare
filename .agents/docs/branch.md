# Git 브랜치 및 협업 규칙
## 0.대원칙
prefix를 제외한 모든 커밋메시지, pr본문, pr제목은 한국어로 작성한다. 

## 1. 목적

안정적인 운영 배포와 원활한 협업을 위해 다음 브랜치 전략을 사용한다.

- `main`에는 `develop`에서 충분히 검증된 코드만 반영한다.
- 일반적인 개발 작업은 `develop`에서 작업 브랜치를 생성하여 진행한다.
- 작업 브랜치를 `main`에 직접 병합하지 않는다.
- 모든 코드 변경은 Pull Request와 코드 리뷰를 통해 병합한다.

## 2. 브랜치 구조

### `main`

운영 환경에 배포할 수 있는 안정적인 코드를 관리한다.

- 직접 커밋하거나 Push하지 않는다.
- 검증된 `develop` 또는 긴급 수정용 `hotfix/*` 브랜치만 병합할 수 있다.
- 운영 배포 시 버전 태그를 생성한다.

예시:

```text
v1.0.0
v1.1.0
v1.1.1
```

### `develop`

다음 배포 버전의 통합 및 검증을 위한 브랜치다.

- 기능 및 일반 수정 작업은 `develop`에서 브랜치를 생성한다.
- 작업이 완료되면 Pull Request를 통해 `develop`으로 병합한다.
- 테스트와 검증이 완료된 코드만 `main`으로 승격한다.

### `feat/*`

새로운 기능을 개발할 때 사용한다.

```text
feat/login
feat/payment
feat/user-profile
```

분기 및 병합 방향:

```text
develop → feat/* → develop
```

### `fix/*`

아직 운영에 배포되지 않은 코드의 버그나 일반적인 결함을 수정할 때 사용한다.

```text
fix/login-validation
fix/payment-timeout
```

분기 및 병합 방향:

```text
develop → fix/* → develop
```

### `hotfix/*`

운영 중인 `main`에서 긴급하게 수정해야 하는 장애나 치명적인 결함에 사용한다.

```text
hotfix/payment-error
hotfix/security-patch
```

분기 및 병합 방향:

```text
main → hotfix/* → main
                  └→ develop
```

`hotfix/*`를 `main`에 병합한 후에는 동일한 변경 사항이 다음 배포에서 누락되지 않도록 반드시 `develop`에도 반영한다.

### 기타 브랜치

필요한 경우 다음 접두사를 사용할 수 있다.

- `refactor/*`: 기능 변경 없는 구조 개선
- `docs/*`: 문서 작성 또는 수정
- `test/*`: 테스트 추가 또는 수정
- `chore/*`: 설정, 빌드, 의존성 등 기타 작업

## 3. 일반 개발 절차

### 작업 브랜치 생성

먼저 최신 `develop`을 기준으로 브랜치를 생성한다.

```bash
git switch develop
git pull origin develop
git switch -c feat/login
```

### 작업 내용 반영

```bash
git add .
git commit -m "feat: 로그인 기능 추가"
git push -u origin feat/login
```

### Pull Request 생성

다음 방향으로 Pull Request를 생성한다.

```text
feat/* → develop
fix/* → develop
refactor/* → develop
```

Pull Request에는 다음 내용을 작성한다.

- 작업 목적
- 주요 변경 사항
- 테스트 및 검증 방법
- 영향을 받는 기능
- 관련 이슈

## 4. `main` 승격 절차

`develop`의 기능 통합과 검증이 끝난 경우에만 `main`으로 승격한다.

```text
작업 브랜치
    ↓
develop 병합
    ↓
통합 테스트 및 검증
    ↓
develop → main Pull Request
    ↓
리뷰 및 승인
    ↓
main 병합 및 배포
```

승격 전 다음 사항을 확인한다.

- 자동화 테스트가 모두 통과했는가?
- 주요 기능에 대한 수동 검증이 완료되었는가?
- 알려진 치명적 오류가 없는가?
- 데이터베이스 및 환경 변수 변경 사항이 확인되었는가?
- 배포 및 롤백 방법이 준비되었는가?
- 변경 사항이 문서화되었는가?

## 5. Pull Request 규칙

- (임시폐지) 최소 1명 이상의 리뷰 승인을 받는다.
- CI 테스트가 모두 통과해야 한다.
- (임시폐지) 리뷰어 본인이 작성한 PR을 단독으로 승인 및 병합하지 않는다.
- 하나의 PR에는 하나의 목적에 해당하는 변경만 포함한다.
- 리뷰 중 변경된 내용은 다시 검증한다.
- 해결되지 않은 리뷰 의견이 있으면 병합하지 않는다.
- `main` 및 `develop` 브랜치에는 직접 Push하지 않는다.

## 6. 커밋 메시지 규칙

커밋 메시지는 다음 형식을 권장한다.

```text
<type>: <변경 내용>
```

사용 가능한 타입:

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `hotfix`: 운영 긴급 수정
- `refactor`: 리팩터링
- `test`: 테스트 변경
- `docs`: 문서 변경
- `chore`: 설정 및 기타 변경

예시:

```text
feat: 소셜 로그인 기능 추가
fix: 로그인 실패 시 오류 메시지 수정
hotfix: 결제 중복 처리 오류 수정
docs: 배포 절차 문서화
```

## 7. 병합 방식

프로젝트에서는 기본적으로 다음 방식을 사용한다.

- 작업 브랜치 → `develop`: Squash Merge
- `develop` → `main`: Merge Commit
- `hotfix/*` → `main`: Merge Commit

작업 브랜치를 병합한 뒤에는 원격 브랜치를 삭제한다.

## 8. 금지 사항

다음 작업은 금지한다.

- `main` 또는 `develop`에 직접 커밋하거나 Push
- 검증되지 않은 코드를 `main`에 병합
- 작업 브랜치에서 `main`으로 직접 Pull Request 생성
- 승인 없이 강제 Push
- 서로 관련 없는 변경을 하나의 Pull Request에 포함
- 긴급하지 않은 작업에 `hotfix/*` 브랜치 사용

## 9. 전체 흐름 요약

```text
일반 개발: develop → feat/fix → develop → 검증 → main
운영 긴급 수정: main → hotfix → main + develop
```

GitHub 또는 GitLab에서는 다음 브랜치 보호 규칙을 함께 설정한다.

- `main`, `develop` 직접 Push 금지
- Pull Request 필수
- 리뷰 승인 필수
- CI 테스트 통과 필수
- 승인되지 않은 강제 Push 금지


## 2026-11-09 일회성 사용자 승인

사용자가 이번 작업에 한해 현재 작업 코드를 PR 없이 원격 main에 직접 push하도록 명시적으로 승인했다. 강제 push는 사용하지 않고 원격 main의 이력을 보존한다. 이후 일반 작업에는 위 기본 브랜치 규칙을 계속 적용한다. main push 시 시험 통과 후 Vultr production 자동 배포를 수행한다.
