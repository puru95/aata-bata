import { raw } from "hono/html";
import { Brand, Layout } from "./layout";
import { builderJs } from "../lib/assets";

/** Home: the builder. The server ships the shell + catalog JSON; the inline script renders the controls. */
export function HomePage(props: { dataJson: string; hasOrders: boolean }) {
  return (
    <Layout script={builderJs()}>
      <div class="wrap">
        <header class="top">
          <Brand />
          {props.hasOrders ? <a class="toplink" href="/my">My orders</a> : null}
        </header>
        <section class="hero">
          <h1>
            <span>Your Grain.</span>
            <span>Your Mix.</span>
            <span>Your Atta.</span>
          </h1>
          <p>Fresh chakki atta in your own mix, delivered to your flat.</p>
          <ul class="pills">
            <li>Ground after you order</li>
            <li>Free delivery</li>
            <li>UPI or cash</li>
          </ul>
        </section>

        <noscript>
          <p class="card">This page needs JavaScript to build your blend. Please open it in Chrome or your phone's browser.</p>
        </noscript>

        <nav class="tracker" aria-label="Order steps">
          <ol id="tracker"></ol>
        </nav>

        <section class="step" id="s1">
          <div class="sh"><span class="n">1</span><h2>How much atta?</h2><span class="side" id="rotis"></span></div>
          <div class="grid5" role="group" aria-label="Order size" id="sizes"></div>
        </section>

        <section class="step" id="s2">
          <div class="sh"><span class="n">2</span><h2>Choose grains</h2></div>
          <div class="grid2" role="group" aria-label="Start from" id="presets"></div>
          <div class="card">
            <div class="fill">
              <span class="kg num" id="fillKg"></span>
              <span class="fstate" id="fstate" role="status"></span>
            </div>
            <div class="comp" id="comp" aria-hidden="true"></div>
            <div class="chips">
              <button class="chip" type="button" id="fillWheat">Fill rest with wheat</button>
              <button class="chip" type="button" id="clear">Clear</button>
              <button class="undo" type="button" id="undo" hidden>Undo</button>
            </div>
            <ul class="grains" id="grains"></ul>
          </div>
          <details class="nut">
            <summary><span id="nutSum">Nutrition</span><span class="chev" aria-hidden="true" /></summary>
            <div class="nin">
              <div class="tog" role="group" aria-label="Show nutrition for">
                <button type="button" id="per100" aria-pressed="true">100 g atta</button>
                <button type="button" id="perRoti" aria-pressed="false">1 roti</button>
              </div>
              <div id="nut"></div>
              <p class="note">
                Source: <a href="https://www.nin.res.in/ebooks/IFCT2017.pdf" rel="noopener" target="_blank">IFCT 2017, ICMR–NIN</a>. A guide, not a lab test.
              </p>
            </div>
          </details>
        </section>

        <section class="step" id="s3">
          <div class="sh"><span class="n">3</span><h2>Grind and delivery</h2></div>
          <div class="grid3" role="group" aria-label="Grind" id="grind"></div>
          <label class="f" for="f-slot">
            <span>Delivery slot</span>
            <select id="f-slot" class="in"></select>
          </label>
        </section>

        <form class="step" id="checkout" novalidate>
          <div class="sh" id="s4"><span class="n">4</span><h2>Your details</h2></div>
          <div class="fields">
            <label class="f full" for="f-name"><span>Name</span>
              <input id="f-name" autocomplete="name" autocapitalize="words" enterkeyhint="next" required aria-describedby="e-name" />
            </label>
            <p class="ferr full" id="e-name"></p>
            <label class="f full" for="f-phone"><span>Mobile number</span>
              <input id="f-phone" type="tel" inputmode="tel" autocomplete="tel-national" enterkeyhint="next" placeholder="10 digits" required aria-describedby="e-phone" />
            </label>
            <p class="ferr full" id="e-phone"></p>
            <label class="f full" for="f-society"><span>Society</span>
              <select id="f-society"></select>
            </label>
            <label class="f" for="f-tower"><span>Tower</span>
              <input id="f-tower" autocapitalize="characters" enterkeyhint="next" placeholder="e.g. B" required aria-describedby="e-tower" />
            </label>
            <label class="f" for="f-flat"><span>Flat</span>
              <input id="f-flat" inputmode="numeric" enterkeyhint="next" placeholder="e.g. 1204" required aria-describedby="e-flat" />
            </label>
            <p class="ferr" id="e-tower"></p>
            <p class="ferr" id="e-flat"></p>
            <label class="f full" for="f-note"><span>Note <em>(optional)</em></span>
              <input id="f-note" enterkeyhint="done" maxlength={200} placeholder="e.g. leave with guard" />
            </label>
          </div>
          <div class="f">
            <span>Payment</span>
            <div class="grid2" role="group" aria-label="Payment" id="pay"></div>
          </div>
          <div class="card sum num" id="sum"></div>
          <p class="err" id="formErr" role="alert"></p>
          <button class="btn" type="submit" id="place">Place order</button>
          <p class="note">We'll confirm your order on WhatsApp before grinding. Prices are pilot estimates.</p>
        </form>

        <footer>Questions? Ask in the society WhatsApp group.</footer>
      </div>

      <div class="bar">
        <div>
          <div>
            <div class="p num" id="barP">₹0</div>
            <div class="s num" id="barS">Fill your bag</div>
            <div class="pg" aria-hidden="true"><i id="barPg" style="width:0"></i></div>
          </div>
          <button type="button" id="barBtn" disabled>Fill your bag</button>
        </div>
      </div>
      <script type="application/json" id="data">{raw(props.dataJson)}</script>
    </Layout>
  );
}
