# main CI/CD 최초 실행 기록

- 사용자 명시 승인으로 PR 없이 remote main 직접 push, fast-forward f54b90b → 7eeb2f8. 강제 push 없음. 기존 문서/이미지/계산 코드 변경도 함께 커밋.
- GitHub Actions42561658722의 application/infrastructure/deploy 모두 성공. backend76·frontend19시험, 빌드, Compose, Terraform fmt/validate/mock1 통과.
- Vultr repository 전용 runner `vultr-family-finance` online/systemd enabled. production 환경은 main만 허용. 기존 SSH/Vultr API 허용 범위 변경 없음.
- runner 공식2.338.2 압축 SHA256 확인. 단기 등록 토큰 사용 후 서버 파일 삭제. SSH 개인키·Vultr 키·Upstage 키를 GitHub secret에 업로드하지 않음. Upstage는 root600 runtime env.
- 공개 HTTPS health의 release와 main SHA 일치. 새 보고서 재현 가정 버전과 API0.3.0 확인. 공개 B/B′ 및83/95세 필요액·65세 전환 smoke 통과.
- 추가 공개 회귀: 변경 생활비185만·입력오류422·미지원null·개인정보 문장 거부·실제 Upstage 제안 확인. 첫 F07은503으로 안전 거부, 1회 재시도 성공.
- 실제 Chrome 새 UI의 보고서 세부식 배너/버전·1.30/1.75억·부모 최저 경로 표시 확인. 버전이 다른 이전 설정은 기본 사례로 안내됨.
- 배포 helper에 공개 계산 smoke까지 포함해 성공 후 current 교체, 실패 시 기존 이미지 복구. 실제 실패를 유발하는 운영 롤백 시험은 수행하지 않음.
- 작업 소스의 키 문자열/개인키 탐지 검사 통과. 환경파일/TF state/계산 원본 파일은 제외.
- 기관 규칙 및 원본 전체 기능 동등성은 검증되지 않음. 인증서 미래 갱신/디스크 용량 관리는 운영 후속.

`first-run.json`, `public-regression.json`, `public-main.jpg`는 최초7eeb2f8 실행의 증거이며 후속 main push 시 release는 달라진다.
