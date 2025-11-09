# web2-projekt
Napredni razvoj programske potpore za web - Drugi projekt (security)

Ranjiva web-aplikacija - Stored XSS + Broken Access Control 

Jednostavna Node.js/Express aplikacija za demonstraciju dviju ranjivosti:

Stored (persistent) XSS - poruke koje korisnik pošalje mogu sadržavati HTML/JS i (ako je prekidač uključen) izvršiti se kod posjetitelja.

Broken Access Control (BAC) - /admin/accounts je u ranjivom modu dostupan svima, u sigurnom modu provjerava se role === 'admin'.

Brzo pokretanje (lokalno):

Klonirati repo i otvoriti folder u terminalu.

Instalirati ovisnosti:

npm install


Pokrenuti aplikaciju:

npm start


Otvoriti u pregledniku: http://localhost:3000

Testni korisnici za demonstraciju

admin / adminpwd - uloga admin

alice / alicepwd - uloga user

Login je  na /login.

Rute i kratki opis

/ - početna (prekidači za ranjivosti po sesiji)

/messages (GET) - prikaži sve poruke (Stored XSS demo)

/messages (POST) - pošalji novu poruku (tekst/HTML)

/user/accounts - korisnički računi

/admin/accounts - admin računi (dostupnost ovisi o BAC prekidaču)

/login i /logout - autentikacija 

Kako testirati Stored XSS:

Na početnoj stranici (/) provjeriti da je Pohranjeni XSS enabled (checked) i kliknuti Save settings.

Otvoriti http://localhost:3000/messages.

U text area upisati:

<script>alert('STORED XSS')</script>

kliknuti Submit message.
4. Ako je XSS uključen - pri prikazu /messages pojavit će se alert('STORED XSS') (skripta se izvršava).
5. Otvoriti novi incognito prozor i posjetiti /messages - isti alert će se pojaviti (pokazuje perzistenciju napada).
6. Isključiti XSS na / i osvježiti /messages - isti sadržaj će sada biti prikazan kao tekst (escapean) i neće se izvršiti.

Poruke se trenutno čuvaju u memoriji (in-memory).Najbrže je restartati server za brisanje poruka (Ctrl+C pa npm start).

Kako testirati Broken Access Control (BAC):

Na početnoj stranici uključiti ili isključiti Broken Access Control prekidač i kliknuti Save settings.

Dok je BAC = ON (ranjivo):

Kao guest ili alice posjetiti /admin/accounts - vidimo admin račune (ranjivost).

Dok je BAC = OFF (sigurno):

Kao guest ili alice posjetiti /admin/accounts - dobiva se 403 Forbidden.

Kao admin posjetiti /admin/accounts - vide se admin račune (ispravno).


Zašto XSS i BAC predstavljaju opasnost 

Stored XSS: napadač može pohraniti JS koji će se izvršavati u preglednicima svih korisnika koji otvorе zaraženu stranicu što može uzrokovati krađu podataka, session hijack, phishing, automatizirane zahtjeve u ime žrtve.

Broken Access Control: ako backend ne provjerava uloge, napadač može pristupiti zaštićenim resursima (npr. admin podacima) jednostavnom manipulacijom URL-a.

Kako su ranjivosti implementirane u kodu 

Stored XSS: server sprema poruke točno onako kako su poslani (messages.push({ text })), a view messages.ejs prikazuje sadržaj neescapeano (<%- m.text %>) kada je prekidač XSS ON.

BAC: ruta /admin/accounts provjerava req.session.toggles.bac. Ako je ON, vraća admin račune svima (ranjivo). Ako je OFF, provjerava req.session.user.role === 'admin' i vraća 403 za neautorizirane.



Start: npm start

U settings hosta postavi environment variable SESSION_SECRET na jaku tajnu (app će pod NODE_ENV=production zahtijevati da varijabla postoji).
