Step 1 — Crea il file .env                                                                                                                                                                                                                                 
                                                                                                                                                                                                                                                             
  cd apps/wow3-renderer                                                                                                                                                                                                                                      
  cp .env.example .env                                                                                                                                                                                                                                       
                                                                                                                                                                                                                                                             
  Poi modifica .env con valori reali:                                                                                                                                                                                                                        
  ADMIN_USER=admin                                          
  ADMIN_PASS=password123
  JWT_SECRET=questo-deve-essere-lungo-almeno-32-caratteri-ok                                                                                                                                                                                                 
  
  Step 2 — Builda l'immagine                                                                                                                                                                                                                                 
                                                            
  Dalla root del monorepo:                                                                                                                                                                                                                                   
  cd /home/fabio/dev/projects/wow3                          
  docker build -f apps/wow3-renderer/Dockerfile -t wow3-renderer:latest .
                                                                                                                                                                                                                                                             
  Prima volta ci vuole qualche minuto (scarica Chromium e FFmpeg via apt).
                                                                                                                                                                                                                                                             
  Step 3 — Avvia il container                               
                                                                                                                                                                                                                                                             
  cd apps/wow3-renderer                                     
  docker compose up
                                                                                                                                                                                                                                                             
  Dovresti vedere:
  Server listening at http://0.0.0.0:3000                                                                                                                                                                                                                    
                                                            
  Step 4 — Verifica
                                                                                                                                                                                                                                                             
  - Admin UI: http://localhost:3000/admin/ → schermata di login WoxGUI                                                                                                                                                                                       
  - Health check rapido: curl http://localhost:3000/jobs/nonexistent/status → dovrebbe restituire 401 (manca l'API key)                                                                                                                                      
                                                                                                                                                                                                                                                             
  Step 5 — Crea una API key dall'admin UI                                                                                                                                                                                                                    
                                                                                                                                                                                                                                                             
  1. Vai su http://localhost:3000/admin/                                                                                                                                                                                                                     
  2. Login con le credenziali del .env                      
  3. Tab "API Keys" → "New API Key" → dai un nome (es. n8n)                                                                                                                                                                                                  
  4. Copia la chiave mostrata (non viene più mostrata)                                                                                                                                                                                                       
                                                                                                                                                                                                                                                             
  Test upload manuale:                                                                                                                                                                                                                                       
  curl -X POST http://localhost:3000/jobs \                 
    -H "X-API-Key: <la-tua-chiave>" \                                                                                                                                                                                                                        
    -F "file=@/path/to/test.wow3a"                   
