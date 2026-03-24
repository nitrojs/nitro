import { html, reactive, component, watch } from "@arrow-js/core";
import type { Props } from "@arrow-js/core";

type Todo = { id: number; text: string; done: boolean };
type Filter = "all" | "active" | "done";

const TodoItem = component(
  (
    props: Props<{
      todo: Todo;
      onToggle: (id: number) => void;
      onRemove: (id: number) => void;
    }>
  ) => {
    return html`
      <li class="${() => (props.todo.done ? "todo done" : "todo")}">
        <button
          class="toggle"
          @click="${() => props.onToggle(props.todo.id)}"
        >
          ${() => (props.todo.done ? "\u2713" : "")}
        </button>
        <span>${() => props.todo.text}</span>
        <button
          class="remove"
          @click="${() => props.onRemove(props.todo.id)}"
        >
          \u00d7
        </button>
      </li>
    `;
  }
);

const Filters = component((props: Props<{ filter: Filter }>) => {
  const filters: Filter[] = ["all", "active", "done"];
  return html`
    <nav class="filters">
      ${filters.map(
        (f) => html`
          <button
            class="${() => (props.filter === f ? "active" : "")}"
            @click="${() => {
              props.filter = f;
            }}"
          >
            ${f}
          </button>
        `
      )}
    </nav>
  `;
});

export function App() {
  const state = reactive({
    todos: [
      { id: 1, text: "Learn reactive state", done: true },
      { id: 2, text: "Build a component", done: false },
      { id: 3, text: "Render a keyed list", done: false },
    ] as Todo[],
    input: "",
    filter: "all" as Filter,
    nextId: 4,
  });

  const filtered = () => {
    if (state.filter === "active") return state.todos.filter((t) => !t.done);
    if (state.filter === "done") return state.todos.filter((t) => t.done);
    return state.todos;
  };

  const remaining = () => state.todos.filter((t) => !t.done).length;

  const addTodo = () => {
    const text = state.input.trim();
    if (!text) return;
    state.todos.push({ id: state.nextId, text, done: false });
    state.nextId++;
    state.input = "";
  };

  const onToggle = (id: number) => {
    const todo = state.todos.find((t) => t.id === id);
    if (todo) todo.done = !todo.done;
  };

  const onRemove = (id: number) => {
    const i = state.todos.findIndex((t) => t.id === id);
    if (i >= 0) state.todos.splice(i, 1);
  };

  watch(() => {
    console.log(
      `[Arrow.js] ${remaining()} of ${state.todos.length} todos remaining`
    );
  });

  return html`
    <div class="app">
      <h1>Nitro + Arrow.js</h1>
      <p class="subtitle">A ~3KB reactive UI with SSR</p>

      <div class="input-row">
        <input
          type="text"
          placeholder="What needs to be done?"
          .value="${() => state.input}"
          @input="${(e: Event) => {
            state.input = (e.target as HTMLInputElement).value;
          }}"
          @keydown="${(e: Event) => {
            if ((e as KeyboardEvent).key === "Enter") addTodo();
          }}"
        />
        <button class="add" @click="${addTodo}">Add</button>
      </div>

      ${Filters(state)}

      <ul class="todo-list">
        ${() =>
          filtered().map((todo) =>
            TodoItem({ todo, onToggle, onRemove }).key(todo.id)
          )}
      </ul>

      <footer class="footer">
        <span>${() => remaining()} items left</span>
        <button
          class="clear"
          @click="${() => {
            state.todos = state.todos.filter((t) => !t.done);
          }}"
        >
          Clear done
        </button>
      </footer>
    </div>
  `;
}
