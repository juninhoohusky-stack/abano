# E-mails de login do Abanô (Supabase Auth)

Cole cada modelo em **Authentication → Emails → Templates** no painel do Supabase.
Copie pelo link "raw" do GitHub, com a tradução do navegador desligada.

## Confirm signup

Assunto:

```
Confirme seu e-mail no Abanô
```

Corpo:

```html
<div style="margin:0;padding:32px 12px;background:#FFF7F5;font-family:Nunito,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#2B1622;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:22px;padding:28px 32px;">
    <p style="margin:0 0 18px;font-size:26px;font-weight:900;color:#D10F5E;">aban<span style="color:#FF8A1E;">ô</span></p>
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;">Falta só confirmar seu e-mail</h1>
    <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#4A3542;">Toque no botão para ativar sua conta do Abanô.</p>
    <p style="margin:0 0 22px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#D10F5E;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:16px;padding:13px 24px;border-radius:999px;">Confirmar meu e-mail</a></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6B5462;">Se você não criou uma conta no Abanô, ignore este e-mail. Nada será feito.</p>
  </div>
</div>
```

## Reset password

Assunto:

```
Crie uma nova senha no Abanô
```

Corpo:

```html
<div style="margin:0;padding:32px 12px;background:#FFF7F5;font-family:Nunito,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#2B1622;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:22px;padding:28px 32px;">
    <p style="margin:0 0 18px;font-size:26px;font-weight:900;color:#D10F5E;">aban<span style="color:#FF8A1E;">ô</span></p>
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;">Vamos criar uma nova senha</h1>
    <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#4A3542;">Toque no botão para escolher uma senha nova. Abra o link no mesmo navegador em que você pediu.</p>
    <p style="margin:0 0 22px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#D10F5E;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:16px;padding:13px 24px;border-radius:999px;">Criar nova senha</a></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6B5462;">Se você não pediu, ignore este e-mail. Sua senha continua a mesma.</p>
  </div>
</div>
```
