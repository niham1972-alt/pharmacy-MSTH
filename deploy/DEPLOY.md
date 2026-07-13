# Deploy to an Oracle Cloud VPS (single VM, IP-only, Docker)

This runs the **frontend + backend on your Oracle VPS**, with **file storage on the VPS** (a Docker volume). **Auth + Database stay on Supabase cloud** (managed) — that's the setup you chose.

Architecture on the box:

```
Internet ── :80 ──► Nginx (serves the SPA)
                     ├─ /api/*     → proxied to the NestJS backend (:3000, internal)
                     └─ /uploads/* → files stored on the VPS (shared Docker volume)
NestJS backend ── Supabase Postgres (managed)  +  Supabase Auth (managed)
```

Because Nginx serves the app **and** proxies `/api` on the **same origin**, there's no CORS or HTTPS needed just to reach the API. (HTTPS needs a domain — see the last section.)

---

## 0. What you need
- An Oracle Cloud account (Always Free is enough).
- The Supabase project you already use (its URL, anon key, service-role key, JWT secret, DB password).
- ~15 minutes.

---

## 1. Create the VM (Oracle Cloud Console)
1. **Menu → Compute → Instances → Create instance**.
2. **Image**: Ubuntu 22.04. **Shape**: `VM.Standard.A1.Flex` (Ampere ARM, Always Free — e.g. 2 OCPU / 12 GB). *(Any x86 shape works too; the images are multi-arch.)*
3. **Networking**: keep the default VCN/subnet; **Assign a public IPv4 address = Yes**.
4. **SSH keys**: upload your public key (or let it generate one and download the private key).
5. **Create**. Note the **public IP** once it's running.

## 2. Open the firewall — BOTH layers (this is the #1 gotcha on Oracle)
Oracle has a **cloud firewall** *and* the VM's **own iptables**. You must open port 80 in both.

**(a) Cloud — VCN Security List:** Networking → Virtual Cloud Networks → your VCN → its Subnet → Security List → **Add Ingress Rules**:
- Source `0.0.0.0/0`, IP Protocol **TCP**, Destination port **80** (HTTP).
- (Port 22 for SSH is usually already open.)

**(b) On the VM — iptables** (Oracle Ubuntu images block everything but 22 by default). SSH in first, then:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save        # persist across reboots
```

## 3. SSH in + install Docker
```bash
ssh ubuntu@<VPS_PUBLIC_IP>

sudo apt-get update && sudo apt-get install -y ca-certificates curl git
# Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker    # run docker without sudo
docker --version && docker compose version
```

## 4. Get the code onto the VM
Either clone your Git repo, or copy the folder up with `scp`/`rsync`:
```bash
# Option A — from a Git remote:
git clone <your-repo-url> pharmacy && cd pharmacy/deploy

# Option B — from your laptop (run locally):
#   rsync -av --exclude node_modules --exclude dist ./ ubuntu@<IP>:~/pharmacy/
#   then: cd ~/pharmacy/deploy
```

## 5. Configure env (real values — never commit these)
```bash
cp backend.env.example backend.env      # fill Supabase DB/URL/keys/JWT secret
cp .env.example .env                    # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
nano backend.env      # (or vi)
nano .env
```
- `backend.env` → `DATABASE_URL` (Supabase **Session Pooler**, port 5432), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, a random `IMPERSONATION_JWT_SECRET` (`openssl rand -base64 48`), `CORS_ORIGINS=http://<VPS_PUBLIC_IP>`.
- `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (leave `VITE_API_BASE_URL=/api`).

## 6. Build + start
```bash
docker compose up -d --build      # first build takes a few minutes on ARM
docker compose ps                 # both services "running"/"healthy"
docker compose logs -f backend    # watch it apply migrations + boot
```
The backend runs `prisma migrate deploy` on start, so your Supabase DB gets any pending migrations automatically.

## 7. (Optional) seed demo data
Only for a fresh/demo DB — **it wipes and re-inserts demo rows** for the seed pharmacy:
```bash
docker compose exec backend npm run seed     # if a seed script is wired; otherwise skip
```
Skip this on a database that already has real data.

## 8. Verify
```bash
curl -s http://localhost/api/health          # {"success":true,...}
```
Then open **`http://<VPS_PUBLIC_IP>/`** in a browser:
- Tenant app login, then the app.
- Platform console at **`http://<VPS_PUBLIC_IP>/platform-admin`**.
- Upload evidence/an attachment → it lands under `/uploads/…` served from the VPS volume.

## 9. Updating later
```bash
cd ~/pharmacy && git pull        # (or rsync again)
cd deploy && docker compose up -d --build
```

## 10. Backups & housekeeping
- **Database** is on Supabase → use Supabase's backups (or `pg_dump` via `DATABASE_URL`).
- **Uploaded files** live in the `uploads` Docker volume on the VM:
  ```bash
  docker run --rm -v deploy_uploads:/data -v $PWD:/backup alpine \
    tar czf /backup/uploads-$(date +%F).tgz -C /data .
  ```
- Logs: `docker compose logs --tail=200 backend`.

---

## Storage note (what "storage on the VPS" means here)
File uploads (GRN attachments, adjustment evidence) are stored **on the VPS**, in the `uploads` Docker volume, and served at `/uploads/…`. The backend exposes `POST /api/files/upload` (auth-required) that takes a data-URL and returns a `/uploads/…` URL to save on the record. Existing screens currently embed small files inline (data-URL in the DB) and keep working; point them at `/api/files/upload` when you want those bytes on the VPS disk instead.

## Going to production properly (later)
- **Domain + HTTPS**: point a domain's A-record at the VPS IP, then add TLS. Easiest is to put **Caddy** in front (auto Let's Encrypt) or run Certbot for Nginx. Then set `VITE_API_BASE_URL=/api` (still same-origin) and browse over `https://yourdomain`.
- **Full self-host of Auth + DB + Storage** (drop Supabase entirely) is a bigger migration — run the self-hosted Supabase docker stack (GoTrue + Storage + Postgres + Kong) and repoint `DATABASE_URL`/`SUPABASE_URL`/JWKS. Ask when you want to go there.
- **MFA for platform staff** and a **separate deployment** for the platform console are recommended before real multi-tenant use (see the platform section of the root README).
