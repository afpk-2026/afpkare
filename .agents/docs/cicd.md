# main → Vultr CI/CD

- 저장소: `afpk-2026/no-named` (비공개). workflow: `.github/workflows/checks.yml`.
- PR/작업 브랜치/main: GitHub Ubuntu 실행기에서 백엔드 시험, 프론트 시험·빌드, Compose 검증, Terraform fmt/validate/mock plan을 실행한다. 실제 Terraform apply는 하지 않는다.
- main push 또는 main 수동 실행: 두 시험 job 성공 후 `production` 환경의 `vultr-production` 전용 실행기로 배포한다. PR은 서버에서 실행하지 않는다. production 배포 브랜치 정책은 main만 허용한다.
- 서버 `/opt/actions-runner`의 `github-deploy` 계정으로 GitHub 공식 runner를 systemd 운영. 초기 설치 2.338.2, 공식 릴리스 SHA256 검증. runner 자체 자동 갱신을 유지한다. GitHub 쪽 연결만 사용하므로 새 인바운드 SSH 규칙이 필요 없다.
- runner는 이 비공개 저장소 전용이다. 저장소를 공개로 전환하기 전 runner를 분리/제거해야 한다. main/workflow 수정 권한은 운영 배포 권한이다. runner 계정의 sudo는 root 소유 `/usr/local/sbin/family-finance-deploy`에 한정하지만, 앱 Dockerfile 배포 권한도 서버 제어 권한으로 취급한다.
- Upstage 키: 서버 root 전용 `/opt/family-finance/runtime/app.env` (600). GitHub secret·아티팩트·로그·Git에 등록하지 않는다. Vultr API 키나 SSH 개인키도 CI에 전달하지 않는다. GitHub의 단기 runner 등록 토큰은 전송 후 삭제한다.
- root 소유 배포 helper의 저장소 원본은 `scripts/deploy_local.sh`. helper 변경 시 관리자 SSH로 설치·검토해야 한다. 실행 checkout 경로와 SHA 검증, Git 추적 소스 allowlist로 릴리스 생성, 서버 env 주입, Docker 빌드·기동·health 검사를 수행한다. 릴리스 ID는 `main-SHA앞12자리`.
- HTTPS overlay/인증서를 유지하고 health 성공 후 current를 교체한다. 배포 실패 시 기존 current의 이미지를 재기동한다. 이전 릴리스와 이미지는 자동 삭제하지 않는다.
- GitHub concurrency와 서버 flock으로 중복 배포를 직렬화하며 실행 중 배포는 새 push로 취소하지 않는다. timeout20분.
- 공개 health·B/B′·83/95세·65세 전환 smoke check도 실행한다. 외부 LLM 일시 실패가 배포를 무작위 차단하지 않도록 LLM 실호출은 결정적 배포 gate에 넣지 않고 별도 검증한다.
- 운영 확인: GitHub Actions 실행 결과, `systemctl status actions.runner.afpk-2026-no-named.vultr-family-finance.service`, 공개 `/api/health`의 release. 서버 재부팅 시 runner도 자동 시작한다.
- 최초 연결은 사용자 승인으로 PR 없이 main 직접 push(강제 push 없음). 이후 브랜치/PR 기본 규칙은 유지한다.

## 최초 실행 확인 · 2026-11-09

원격 main 7eeb2f814e4a push로 [Actions42561658722](https://github.com/afpk-2026/no-named/actions/runs/42561658722)의 application/infrastructure/deploy가 모두 성공했다. 공개 `/api/health`는 `main-7eeb2f814e4a`, API0.3.0, `report-reproduction-2026-11-09-v1`을 반환했다. 새 계약 B/B′·83/95세 필요액·65세 전환·오류/미지원·실제 Upstage까지 공개 검사했다. F07 첫 실호출은503으로 안전 거부됐고 1회 수동 재시도는 성공했다. Chrome의 새 계산 화면도 확인했다. 기록은 `.agents/verification/cicd/`. 현재 release는 이후 main push에 따라 갱신된다.
