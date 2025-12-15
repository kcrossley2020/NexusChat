# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - img "Nex by Videxa - Healthcare Claims Logo" [ref=e5]
    - button "Switch to dark theme" [ref=e7] [cursor=pointer]:
      - img [ref=e8]
    - generic [ref=e15]:
      - heading "Welcome back" [level=1] [ref=e16]
      - alert [ref=e17]: Too many login attempts in a short amount of time. Please try again later.
      - form "Login form" [ref=e18]:
        - generic [ref=e20]:
          - textbox "Email" [ref=e21]:
            - /placeholder: " "
            - text: e2e-msg-1765813811931@example.com
          - generic [ref=e22]: Email address
        - generic [ref=e24]:
          - textbox "Password" [ref=e25]:
            - /placeholder: " "
            - text: TestPass123!
          - generic [ref=e26]: Password
        - link "Forgot Password?" [ref=e27] [cursor=pointer]:
          - /url: /forgot-password
        - button "Continue" [ref=e29] [cursor=pointer]
      - paragraph [ref=e30]:
        - text: Don't have an account?
        - link "Sign up" [ref=e31] [cursor=pointer]:
          - /url: /register
    - contentinfo [ref=e32]:
      - link "Privacy policy" [ref=e33] [cursor=pointer]:
        - /url: https://videxa.ai/privacy-policy
      - link "Terms of service" [ref=e35] [cursor=pointer]:
        - /url: https://videxa.ai/terms
  - region "Notifications (F8)":
    - list
```