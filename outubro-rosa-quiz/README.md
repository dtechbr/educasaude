# Desafio Outubro Rosa — USF Vila Dutra

Quiz ao vivo para 10–15 participantes, com 10 questões, 30 segundos cada, link/QR code, múltipla escolha, verdadeiro/falso, seleção de várias alternativas e ranking em tempo real.

**Página dos participantes:** `https://dtechbr.github.io/educasaude/outubro-rosa-quiz/`

**Painel do apresentador:** `https://dtechbr.github.io/educasaude/outubro-rosa-quiz/host.html`

Arquivos guardados na pasta `outubro-rosa-quiz` para não substituir a página principal do EducaSaúde.

## Ativação no Firebase

Projeto: `coordenacao-fbda9`.

1. Confirme que existe um banco **Cloud Firestore**.
2. Em **Authentication → Sign-in method**, habilite os provedores **Google** (apresentador) e **Anônimo** (participantes).
3. Em **Authentication → Settings → Authorized domains**, autorize `dtechbr.github.io` se ele não estiver na lista.
4. Em **Firestore Database → Regras**, **adicione os blocos** `match /rosaQuizSessions/{code}` e seus helpers, disponíveis no arquivo `firestore.rules`, dentro de `match /databases/{database}/documents` das regras existentes. **Não substitua as regras completas**, porque este projeto também sustenta outras aplicações.
5. No GitHub `dtechbr/educasaude`, verifique em **Settings → Pages** se a publicação pelo branch `main` na pasta `/ (root)` está ativa. É preciso ativar, caso ainda não esteja. No primeiro acesso, aguarde a publicação da atualização.
6. Abra o painel, entre com Google, crie a sala e compartilhe o QR code. Os participantes entram no site com código e apelido.
7. Mantenha a aba do apresentador aberta enquanto a atividade acontece. O encerramento automático das perguntas depende dela; se a aba fechar, reabra o mesmo endereço no mesmo navegador e entre novamente com a mesma conta.

## Pontuação

Uma resposta completamente correta vale 1.000 pontos + até 600 de bônus pelo tempo restante (20 por segundo). A questão 8 exige as três alternativas corretas, sem alternativas adicionais. Respostas erradas ou enviadas após o prazo não pontuam.

## Proteção de acesso e limites

- As sessões ficam isoladas na coleção `rosaQuizSessions`. Não guarda prontuários ou dados assistenciais.
- Para melhorar a segurança, o apresentador exige login Google, os participantes entram com autenticação anônima. As regras impedem que o participante altere seus pontos.
- As perguntas/gabaritos estão em JavaScript público; é uma atividade educativa de baixa criticidade, **não um sistema de avaliação resistente a fraude**.
- Qualquer conta Google autorizada no projeto pode criar salas. Se desejar restringir a criação a contas administrativas, complemente as regras usando e-mails explicitamente permitidos.
- O **Cloud Firestore** e a autenticação normalmente oferecem uma camada gratuita com limites de uso (consulte sua cota do projeto). Não foi necessário instalar backend ou Cloud Functions.

## Resolução de problemas

- `permission-denied`: regras não publicadas ou autenticação desativada.
- `auth/unauthorized-domain`: autorize `dtechbr.github.io` no Firebase Auth.
- Botões não carregam: confira a publicação do GitHub Pages e o Console do navegador.
- Se a tela não atualizar, confirme conexão à internet no apresentador e nos celulares.
