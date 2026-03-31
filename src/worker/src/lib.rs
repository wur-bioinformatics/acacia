use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use web_sys::{OffscreenCanvas, OffscreenCanvasRenderingContext2d};

#[derive(Debug, Clone)]
pub struct State {
    render_context: Option<OffscreenCanvasRenderingContext2d>,
    x: f64,
    y: f64,
}

impl State {
    fn update(&mut self) {
        self.x = self.x + 10.0;
        self.y = self.y + 10.0;
    }
}

impl Default for State {
    fn default() -> Self {
        Self {
            render_context: None,
            x: 0.0,
            y: 0.0,
        }
    }
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default())
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace=console)]
    fn log(msg: &str);
}

#[wasm_bindgen]
pub fn init_canvas(canvas: JsValue) -> Result<(), JsValue> {
    let canvas: OffscreenCanvas = canvas
        .dyn_into()
        .map_err(|_| JsValue::from_str("Canvas is not an OffscreenCanvas"))?;

    let context = canvas
        .get_context("2d")
        .map_err(|_| JsValue::from_str("Failed to get 2D context"))?
        .ok_or_else(|| JsValue::from_str("No context returned"))?
        .dyn_into::<OffscreenCanvasRenderingContext2d>()
        .map_err(|_| JsValue::from_str("Context is not 2D"))?;

    STATE.with(|s| {
        *s.borrow_mut() = State {
            render_context: Some(context),
            x: 0.0,
            y: 0.0,
        };
    });
    Ok(())
}

#[wasm_bindgen]
pub fn update() -> Result<(), JsValue> {
    STATE.with(|s| {
        s.borrow_mut().update();
    });
    Ok(())
}

#[wasm_bindgen]
pub fn draw() -> Result<(), JsValue> {
    STATE.with(|s| {
        let state = s.borrow();
        match &state.render_context {
            Some(context) => {
                context.set_fill_style_str("red");
                context.fill_rect(state.x, state.y, 200.0, 200.0);
            }
            None => (),
        }
    });
    Ok(())
}
