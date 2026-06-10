import { Children, isValidElement } from 'react';

function Header({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

function Body({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

function Footer({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

function Side({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

type ChatShellComponent = ((props: { children?: React.ReactNode }) => React.JSX.Element) & {
  Header: typeof Header;
  Body: typeof Body;
  Footer: typeof Footer;
  Side: typeof Side;
};

const ChatShell: ChatShellComponent = Object.assign(
  function ChatShell({ children }: { children?: React.ReactNode }): React.JSX.Element {
    let header: React.ReactNode = null;
    let body: React.ReactNode = null;
    let footer: React.ReactNode = null;
    let side: React.ReactNode = null;

    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Header) header = child;
      else if (child.type === Body) body = child;
      else if (child.type === Footer) footer = child;
      else if (child.type === Side) side = child;
    });

    return (
      <div className="flex flex-1 overflow-hidden min-w-0">
        <div className="relative flex flex-col flex-1 min-w-0">
          {header}
          {body}
          {footer && (
            <div className="absolute bottom-0 left-0 right-0 z-sticky bg-gradient-to-t from-bg from-20% to-transparent px-4 pb-4 pt-1">
              <div className="max-w-170 mx-auto w-full flex flex-col gap-3">{footer}</div>
            </div>
          )}
        </div>
        {side && (
          <div data-side-panel className="w-72 shrink-0">
            {side}
          </div>
        )}
      </div>
    );
  },
  { Header, Body, Footer, Side },
);

export { ChatShell };
