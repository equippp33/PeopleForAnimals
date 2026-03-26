import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import Stepper from "./_components/Stepper";

const LoginForm = React.forwardRef<View>((props, ref) => {
  return (
    <View ref={ref} className="flex-1 justify-end px-6 pb-10">
      <Stepper />
      <TextInput
        placeholder="Select name"
        className="mb-4 rounded-lg bg-white px-4 py-3"
      />
      <TextInput
        placeholder="Doctor ID"
        className="mb-4 rounded-lg bg-white px-4 py-3"
      />
      {/* Remember me checkbox if needed */}
      <TouchableOpacity className="mt-2 rounded-full bg-orange-500 py-3">
        <Text className="text-center font-semibold text-white">Continue</Text>
      </TouchableOpacity>
    </View>
  );
});

LoginForm.displayName = "LoginForm";

export default LoginForm;
