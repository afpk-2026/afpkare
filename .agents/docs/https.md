# Vultr IP HTTPS 운영

사용자 승인: 2026-11-09 기존 서버에 무료 IP HTTPS 추가. HTTP도 유지한다.

- 공개 주소: https://158.247.203.92/ (HTTP/HTTPS의 localStorage는 서로 독립적)
- Terraform: 기존 서버 그대로, IPv4 TCP443 규칙1개 추가·방화벽 설명 수정. 추가 유료 자원 없음. 기존 월$10 계획 유지.
- Certbot5.9.0을 서버 전용 venv에 설치. Let's Encrypt `shortlived` IP 인증서, HTTP-01 webroot 방식. staging dry-run 후 공인 인증서를 발급한다. staging 인증서를 서비스에 설치하지 않는다.
- 서버에서 `cd /opt/family-finance/current && bash scripts/enable_https.sh PUBLIC_IPV4` 실행. Terraform plan/apply와 앱 배포가 선행되어야 한다.
- `/etc/letsencrypt`의 ACME 계정과 개인키는 서버에만 보관. nginx에는 `/opt/family-finance/tls/certs`만 읽기 전용 마운트. Git/배포 압축/Terraform state에 키를 넣지 않는다. 이메일은 등록하지 않는다.
- systemd `family-finance-certbot.timer`: 매일00·12시 UTC + 최대30분 분산, 누락 실행 복구. `certbot renew`가 실제 갱신 필요 여부를 판단한다.
- 갱신 deploy hook은 인증서를 교체하고 현재 릴리스의 nginx 구문 검사 후 reload. 다음 앱 배포도 TLS overlay를 자동 유지한다. HTTP01 검증용80포트를 닫지 않는다.
- 확인: `systemctl list-timers family-finance-certbot.timer`, `journalctl -u family-finance-certbot.service`, `certbot renew --dry-run --run-deploy-hooks --no-random-sleep-on-renew`. 실제 타이머의 미래 갱신 성공은 운영 중 감시해야 한다.
- rollback: TLS 대응 릴리스에서 APP_VERSION을 맞춘.env와 overlay를 사용해 compose up, health 확인 후 current 심볼릭 링크 교체. 최초 P0처럼 TLS 구성 없는 릴리스는 HTTPS를 유지하는 롤백 대상으로 사용할 수 없다.

근거: [Let's Encrypt IP Certbot 공식 안내](https://letsencrypt.org/2026/03/11/shorter-certs-certbot.html), [Certbot 공식 운영 문서](https://eff-certbot.readthedocs.io/en/stable/using.html). IP 인증서는6일 유효하므로 자동 갱신이 필수다.
