import { createTheme } from "@mui/material/styles";

export function createMuiThemeFromDato(
  primaryColor: string,
  accentColor: string,
  lightColor: string,
  darkColor: string
) {
  return createTheme({
    palette: {
      primary: { main: primaryColor },
      secondary: { main: accentColor, light: lightColor, dark: darkColor },
    },
    components: {
      MuiAutocomplete: {
        styleOverrides: {
          option: ({ theme }) => ({
            '&[aria-selected="true"]': {
              backgroundColor: `${theme.palette.primary.main} !important`,
              "*": {
                color: `${theme.palette.primary.contrastText} !important`,
              },
            },
            "&:hover": {
              backgroundColor: `${theme.palette.secondary.light} !important`,
              "*": {
                color: `${theme.palette.secondary.dark} !important`,
              },
            },
            "&.Mui-focused": {
              backgroundColor: "unset",
            },
          }),
        },
      },
    },
  });
}
