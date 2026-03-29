import React from "react";
import { Alert, Box, Button, Typography } from "@mui/material";

export default class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("ChartErrorBoundary", error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ py: 2 }}>
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={() => this.setState({ error: null })}>
                Retry
              </Button>
            }
          >
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Charts could not render
            </Typography>
            <Typography variant="caption" component="div" sx={{ wordBreak: "break-word" }}>
              {this.state.error?.message || "Unknown error"}. The table below may still work.
            </Typography>
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}
